import { Component, inject } from '@angular/core';
import { LgButton, LgTooltip } from '@logigator/ui';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { createScissorToggle } from '../../work-mode/work-mode-tools';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { OnboardTargetDirective } from '../../onboarding/onboard-target.directive';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * Floating pill hosting the select tool's scissor sub-toggle, which cuts wires
 * at the marquee edge. Rendered only while the select tool is active. On touch
 * it is the only way to scissor; on desktop its tooltip is where the
 * hold-to-scissor key is discovered.
 */
@Component({
  selector: 'app-scissor-toggle',
  imports: [LgButton, LgTooltip, TranslateDirective, OnboardTargetDirective],
  template: `
    @if (toggle.isVisible()) {
      <div
        *appTranslate="let t"
        class="flex items-center rounded-full bg-content/95 px-1.5 py-1 shadow-lg backdrop-blur"
      >
        <lg-button
          appOnboardTarget="scissor-toggle"
          [icon]="toggle.icon"
          severity="secondary"
          rounded
          [text]="!toggle.isActive()"
          [label]="t(toggle.shortLabelKey)"
          [lgTooltip]="t(toggle.labelKey)"
          [tooltipShortcut]="shortcutService.binding(toggle.shortcut)()"
          tooltipPosition="bottom"
          [ariaLabel]="t(toggle.labelKey)"
          (onClick)="toggle.toggle()"
        ></lg-button>
      </div>
    }
  `
})
export class ScissorToggleComponent {
  private readonly workModeService = inject(WorkModeService);
  protected readonly shortcutService = inject(ShortcutService);

  protected readonly toggle = createScissorToggle(
    this.workModeService,
    this.shortcutService
  );
}
