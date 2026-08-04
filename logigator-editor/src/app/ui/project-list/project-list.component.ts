import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ConfirmationService,
  LgButton,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgPaginator,
  type LgPaginatorState,
  LgTooltip
} from '@logigator/ui';
import { TranslationService } from '../../translation/translation.service';
import { LocalDatePipe } from '../../utils/local-date/local-date.pipe';
import { TranslateDirective } from '../../translation/translate.directive';

export interface ProjectListItem {
  id: string;
  name: string;
  lastEdited: string | number;
  /** Cloud share token; present on server items, drives the share dialog. */
  link?: string;
  /** Cloud public visibility; present on server items. */
  isPublic?: boolean;
}

const PAGE_SIZE = 20;
/** Mirrors the backend `UpdateProject.name` `@MaxLength(20)` constraint. */
const NAME_MAX_LENGTH = 20;

@Component({
  selector: 'app-project-list',
  imports: [
    LocalDatePipe,
    FormsModule,
    LgButton,
    LgInputText,
    LgIconField,
    LgInputIcon,
    LgPaginator,
    LgTooltip,
    TranslateDirective
  ],
  templateUrl: './project-list.component.html'
})
export class ProjectListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translation = inject(TranslationService);
  private readonly injector = inject(Injector);

  readonly items = input<ProjectListItem[]>([]);
  readonly loading = input(false);
  readonly page = input(0);
  readonly totalItems = input(0);
  /** Whether each row offers an upload-to-cloud button (local projects only). */
  readonly showUpload = input(false);
  /** Whether each row offers a share button (cloud projects only). */
  readonly showShare = input(false);

  readonly open = output<string>();
  readonly delete = output<ProjectListItem>();
  readonly rename = output<{ id: string; name: string }>();
  readonly upload = output<ProjectListItem>();
  readonly share = output<ProjectListItem>();
  readonly pageChange = output<number>();
  readonly searchChange = output<string>();

  protected readonly pageSize = PAGE_SIZE;
  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected searchQuery = '';

  // Inline-rename state: the id of the row currently in edit mode (or null) and
  // the working name bound to its input.
  protected readonly editingId = signal<string | null>(null);
  protected readonly editValue = signal('');
  private readonly renameInput =
    viewChild<ElementRef<HTMLInputElement>>('renameInput');

  protected paginatorFirst = computed(() => this.page() * PAGE_SIZE);

  protected onSearchInput(): void {
    this.searchChange.emit(this.searchQuery);
  }

  protected startRename(event: Event, item: ProjectListItem): void {
    event.stopPropagation();
    event.preventDefault();
    this.editValue.set(item.name);
    this.editingId.set(item.id);
    // The input is rendered by the @if branch this signal flip enables, so focus
    // it only once that render has flushed.
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
   * Commits the rename if the row is still in edit mode and the trimmed name is
   * non-empty and actually changed. Both Enter and blur route here; the
   * edit-mode guard makes the second (blur firing after Enter already closed the
   * editor) a no-op.
   */
  protected commitRename(event: Event, item: ProjectListItem): void {
    event.stopPropagation();
    if (this.editingId() !== item.id) return;
    this.editingId.set(null);
    const name = this.editValue().trim();
    if (name && name !== item.name) {
      this.rename.emit({ id: item.id, name });
    }
  }

  protected cancelRename(event: Event): void {
    event.stopPropagation();
    this.editingId.set(null);
  }

  protected onUploadClick(event: Event, item: ProjectListItem): void {
    event.stopPropagation();
    event.preventDefault();
    this.upload.emit(item);
  }

  protected onShareClick(event: Event, item: ProjectListItem): void {
    event.stopPropagation();
    event.preventDefault();
    this.share.emit(item);
  }

  protected onDeleteClick(event: Event, item: ProjectListItem): void {
    event.stopPropagation();
    event.preventDefault();

    this.confirmationService.confirm({
      key: 'inline',
      target: event.currentTarget as HTMLElement,
      message: this.translation.translate(
        'openProjectDialog.deleteConfirmMessage',
        { name: item.name }
      ),
      acceptButtonProps: { severity: 'danger' },
      acceptLabel: this.translation.translate('openProjectDialog.deleteAccept'),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      rejectLabel: this.translation.translate('openProjectDialog.deleteReject'),
      accept: () => this.delete.emit(item)
    });
  }

  protected onPaginatorChange(state: LgPaginatorState): void {
    this.pageChange.emit(state.page ?? 0);
  }
}
