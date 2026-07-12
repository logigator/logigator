import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormsModule } from '@angular/forms';
import logoUrl from '@assets/logo.svg';
import { ProjectService } from '../../project/project.service';
import { LgButton, LgInputText, LgMenubar, LgTooltip } from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { UserSettingsComponent } from '../user-settings/user-settings.component';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { PersistenceService } from '../../persistence/persistence.service';
import { ToastService } from '../../logging/toast.service';
import { EditorMenuService } from '../editor-menu.service';
import {
  SourceIndicatorComponent,
  SourceIndicatorState
} from '../source-indicator/source-indicator.component';

/** Longest project name accepted, matching the save dialog and open-project list. */
const NAME_MAX_LENGTH = 20;

@Component({
  selector: 'app-title-bar',
  imports: [
    LgMenubar,
    LgButton,
    LgInputText,
    LgTooltip,
    FormsModule,
    NgOptimizedImage,
    UserSettingsComponent,
    SourceIndicatorComponent,
    TranslocoDirective
  ],
  templateUrl: './title-bar.component.html'
})
export class TitleBarComponent {
  private readonly projectService = inject(ProjectService);
  private readonly projectMetadataStore = inject(ProjectMetadataStore);
  private readonly persistence = inject(PersistenceService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);

  protected readonly logoUrl = logoUrl;
  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  protected readonly items = inject(EditorMenuService).items;

  protected readonly projectMetadata = computed(() => {
    const project = this.projectService.mainProject();
    if (!project) {
      return null;
    }

    return this.projectMetadataStore.getMetadata(project) ?? null;
  });

  protected readonly projectName = computed(
    () => this.projectMetadata()?.name ?? ''
  );

  /**
   * Whether the name can be renamed inline. Only real projects (not component
   * editors) that aren't read-only shares; the persistence layer enforces the
   * same guard, this just gates the affordance.
   */
  protected readonly canRename = computed(() => {
    const metadata = this.projectMetadata();
    return (
      !!metadata && metadata.type === 'project' && metadata.source !== 'share'
    );
  });

  // Inline-rename state: whether the name is in edit mode and the working value
  // bound to the input.
  protected readonly editing = signal(false);
  protected readonly editValue = signal('');
  private readonly renameInput =
    viewChild<ElementRef<HTMLInputElement>>('renameInput');

  protected startRename(): void {
    if (!this.canRename()) return;
    this.editValue.set(this.projectName());
    this.editing.set(true);
    // The input is rendered by the @if branch this flag enables, so focus it
    // only once that render has flushed.
    afterNextRender(
      () => {
        const el = this.renameInput()?.nativeElement;
        el?.focus();
        el?.select();
      },
      { injector: this.injector }
    );
  }

  /**
   * Commits the rename if still in edit mode and the trimmed name is non-empty
   * and actually changed. Both Enter and blur route here; the edit-mode guard
   * makes the second (blur firing after Enter already closed the editor) a
   * no-op.
   */
  protected commitRename(): void {
    if (!this.editing()) return;
    this.editing.set(false);
    const project = this.projectService.mainProject();
    const name = this.editValue().trim();
    if (!project || !name || name === this.projectName()) return;
    this.persistence.renameOpenProject(project, name).catch((err: unknown) => {
      this.toast.error(
        this.transloco.translate('titleBar.rename.error'),
        'TitleBarComponent',
        err
      );
    });
  }

  protected cancelRename(): void {
    this.editing.set(false);
  }

  /**
   * The provenance/state chip shown next to the project name: `server` (cloud),
   * `browser` (saved locally), `draft` (a browser circuit not yet written to
   * storage — empty id) or `share` (opened read-only from a share link). Covers
   * both projects and component editors shown as main; `null` only when there is
   * no project. The upload affordance lives in the File menu and Open dialog.
   */
  protected readonly sourceChip = computed<SourceIndicatorState | null>(() => {
    const metadata = this.projectMetadata();
    if (!metadata) return null;
    if (metadata.source === 'share') return 'share';
    if (metadata.source === 'server') return 'server';
    return metadata.id !== '' ? 'browser' : 'draft';
  });
}
