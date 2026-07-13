import { Component, computed, inject, input } from '@angular/core';
import { Point } from 'pixi.js';
import { TranslocoDirective } from '@jsverse/transloco';
import { formatShortcutLabel } from '@logigator/ui';
import { TranslationService } from '../../translation/translation.service';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { ComponentProviderService } from '../../components/component-provider.service';
import { TranslationKey } from '../../translation/translation-key.model';
import {
  LocalizableText,
  resolveLocalizableText
} from '../../components/component-config.model';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';

/**
 * Compact mode + grid-position pill, the top-right overlay that replaces the
 * 4-segment desktop status bar on `isCompact`. The host caps its width (see
 * app template), so the mode hint truncates while the coordinates — the part
 * that must stay readable — never wrap or shrink.
 */
@Component({
  selector: 'app-mobile-status',
  imports: [TranslocoDirective],
  template: `
    <div
      *transloco="let t"
      class="flex items-center gap-2 rounded-full bg-content/80 px-3 py-1 text-xs text-muted shadow backdrop-blur"
    >
      <span class="min-w-0 truncate">{{
        t(workMode(), {
          componentName: text(selectedComponentName()),
          scissorKey: scissorKeyLabel()
        })
      }}</span>
      <span class="shrink-0 opacity-50">&middot;</span>
      <span class="shrink-0 whitespace-nowrap tabular-nums">{{
        boardPositionFormatted()
      }}</span>
    </div>
  `
})
export class MobileStatusComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly componentProviderService = inject(ComponentProviderService);
  private readonly translation = inject(TranslationService);
  private readonly shortcutService = inject(ShortcutService);

  public readonly cursorPosition = input<Point>(new Point(0, 0));

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
