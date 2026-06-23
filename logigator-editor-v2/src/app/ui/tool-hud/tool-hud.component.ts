import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Popover } from 'primeng/popover';
import { TranslocoDirective } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import {
  createWorkModeTools,
  WorkModeToolId
} from '../../work-mode/work-mode-tools';
import { MobileUiService } from '../../layout/mobile-ui.service';

/** Tool ids shown directly in the HUD's always-visible primary row. */
const PRIMARY_IDS: readonly WorkModeToolId[] = ['pan', 'select', 'wire'];

/**
 * Floating mode HUD for `isCompact`: an always-visible primary row
 * (pan / select / wire / parts / more) plus a popover holding the remaining
 * tools. Renders from the same `createWorkModeTools` descriptors as the desktop
 * tool bar, so the two surfaces never diverge.
 */
@Component({
  selector: 'app-tool-hud',
  imports: [ButtonModule, Popover, TranslocoDirective],
  templateUrl: './tool-hud.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolHudComponent {
  private readonly workModeService = inject(WorkModeService);
  protected readonly mobileUi = inject(MobileUiService);

  private readonly tools = createWorkModeTools(this.workModeService);

  protected readonly primaryTools = PRIMARY_IDS.map(
    (id) => this.tools.find((t) => t.id === id)!
  );
  protected readonly moreTools = this.tools.filter(
    (t) => !PRIMARY_IDS.includes(t.id)
  );

  protected readonly partsOpen = computed(
    () => this.mobileUi.activeSheet() === 'palette'
  );
  protected readonly moreActive = computed(() =>
    this.moreTools.some((t) => t.isActive())
  );
  /** Label of the active tool, shown above the row; null while none is armed. */
  protected readonly activeLabelKey = computed(
    () => this.tools.find((t) => t.isActive())?.labelKey ?? null
  );

  protected toggleParts(): void {
    this.mobileUi.toggle('palette');
  }
}
