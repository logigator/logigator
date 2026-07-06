import { Component, computed, inject, input } from '@angular/core';
import { Point } from 'pixi.js';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { ComponentProviderService } from '../../components/component-provider.service';
import { TranslationKey } from '../../translation/translation-key.model';
import {
  LocalizableText,
  resolveLocalizableText
} from '../../components/component-config.model';

/**
 * Compact mode + grid-position pill, the top-left overlay that replaces the
 * 4-segment desktop status bar on `isCompact`.
 */
@Component({
  selector: 'app-mobile-status',
  imports: [TranslocoDirective],
  template: `
    <div
      *transloco="let t"
      class="flex items-center gap-2 rounded-full bg-content/80 px-3 py-1 text-xs text-muted shadow backdrop-blur"
    >
      <span>{{
        t(workMode(), { componentName: text(selectedComponentName()) })
      }}</span>
      <span class="opacity-50">&middot;</span>
      <span class="tabular-nums">{{ boardPositionFormatted() }}</span>
    </div>
  `
})
export class MobileStatusComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly componentProviderService = inject(ComponentProviderService);
  private readonly translocoService = inject(TranslocoService);

  public readonly cursorPosition = input<Point>(new Point(0, 0));

  protected readonly boardPositionFormatted = computed(
    () =>
      `${Math.round(this.cursorPosition().x)}, ${Math.round(this.cursorPosition().y)}`
  );

  protected readonly workMode = computed(
    () => `statusBar.modes.${this.workModeService.mode()}` as TranslationKey
  );

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
      this.translocoService.translate(key)
    );
  }
}
