import { Component, inject } from '@angular/core';
import { LgButton, LgTooltip } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { createScissorToggle } from '../../work-mode/work-mode-tools';
import { ShortcutService } from '../../shortcuts/shortcut.service';

/**
 * Floating pill over the canvas hosting the select tool's scissor sub-toggle
 * (cut wires at the marquee edge). Renders only while the select tool is
 * active; on touch it is the only way to scissor, on desktop the tooltip's
 * shortcut hint doubles as discovery for the hold-to-scissor key.
 */
@Component({
  selector: 'app-scissor-toggle',
  imports: [LgButton, LgTooltip, TranslocoDirective],
  template: `
    @if (toggle.isVisible()) {
      <div
        *transloco="let t"
        class="flex items-center rounded-full bg-content/95 px-1.5 py-1 shadow-lg backdrop-blur"
      >
        <lg-button
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

  protected readonly toggle = createScissorToggle(this.workModeService);
}
