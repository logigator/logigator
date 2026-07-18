import { Component, computed, inject, input } from '@angular/core';
import { formatShortcutLabel } from '@logigator/ui';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { TranslocoDirective } from '@jsverse/transloco';
import { TranslationService } from '../../translation/translation.service';
import { TranslationKey } from '../../translation/translation-key.model';
import { Point } from 'pixi.js';
import { ComponentProviderService } from '../../components/component-provider.service';
import {
  LocalizableText,
  resolveLocalizableText
} from '../../components/component-config.model';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { ProjectService } from '../../project/project.service';
import { SelectionInspectorService } from '../../project/selection-inspector.service';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';

@Component({
  selector: 'app-status-bar',
  imports: [TranslocoDirective],
  templateUrl: './status-bar.component.html'
})
export class StatusBarComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly componentProviderService = inject(ComponentProviderService);
  private readonly translation = inject(TranslationService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);
  private readonly selectionInspector = inject(SelectionInspectorService);
  private readonly shortcutService = inject(ShortcutService);

  protected readonly selectionCount = this.selectionInspector.selectionCount;

  public readonly cursorPosition = input<Point>(new Point(0, 0));

  protected readonly dirty = computed(() => {
    const project = this.projectService.activeProject();
    return project ? this.metadataStore.isDirty(project) : false;
  });

  protected readonly boardPositionFormatted = computed(
    () =>
      `${Math.round(this.cursorPosition().x)}, ${Math.round(this.cursorPosition().y)}`
  );

  protected readonly workMode = computed(
    () => `statusBar.modes.${this.workModeService.mode()}` as TranslationKey
  );

  /** The select-mode hint's hold-to-scissor key, tracking rebinds live. */
  protected readonly scissorKeyLabel = computed(() => {
    const binding = this.shortcutService.binding(
      ShortcutActionEnum.SELECT_SCISSOR
    )();
    return binding ? formatShortcutLabel(binding) : '–';
  });

  protected readonly selectedComponentName = computed((): LocalizableText => {
    const comp = this.workModeService.selectedComponentType();
    if (comp === null) {
      return { literal: '' };
    }
    return (
      this.componentProviderService.getComponent(comp)?.name ?? { literal: '' }
    );
  });

  /** Resolves display text: translates a key, returns a literal verbatim. */
  protected text(value: LocalizableText): string {
    return resolveLocalizableText(value, (key) =>
      this.translation.translate(key)
    );
  }
}
