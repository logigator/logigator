import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { LgButton } from '@logigator/ui';
import { Popover } from 'primeng/popover';
import { TranslocoDirective } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { BuiltInComponentType } from '../../components/component-type.enum';
import {
  createWorkModeTools,
  WorkModeToolId
} from '../../work-mode/work-mode-tools';
import { MobileUiService } from '../../layout/mobile-ui.service';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';

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
  imports: [LgButton, Popover, TranslocoDirective],
  templateUrl: './tool-hud.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolHudComponent {
  private readonly workModeService = inject(WorkModeService);
  protected readonly mobileUi = inject(MobileUiService);
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);

  private readonly tools = createWorkModeTools(this.workModeService);

  /** True while the active tab is a custom-component editor — the desktop side
   *  bar shows the Ports panel here; the HUD's "more" popover exposes it. */
  protected readonly isEditingComponent = computed(() => {
    const active = this.projectService.activeProject();
    return !!active && this.metadataStore.getMetadata(active)?.type === 'comp';
  });

  protected readonly primaryTools = PRIMARY_IDS.map(
    (id) => this.tools.find((t) => t.id === id)!
  );
  protected readonly moreTools = this.tools.filter(
    (t) => !PRIMARY_IDS.includes(t.id)
  );

  /**
   * Placing a palette component (the Parts flow) — TEXT excluded, since it has
   * its own tool in the "more" popover that lights up instead.
   */
  protected readonly placingComponent = computed(
    () =>
      this.workModeService.mode() === WorkMode.COMPONENT_PLACEMENT &&
      this.workModeService.selectedComponentType() !== BuiltInComponentType.TEXT
  );

  // The Parts button is "armed" while the palette sheet is open or a palette
  // component is being placed, so it reads as active like the other mode tools.
  protected readonly partsActive = computed(
    () => this.mobileUi.activeSheet() === 'palette' || this.placingComponent()
  );
  protected readonly moreActive = computed(() =>
    this.moreTools.some((t) => t.isActive())
  );
  /** Label shown above the row; null while no mode is armed. */
  protected readonly activeLabelKey = computed(() => {
    const activeTool = this.tools.find((t) => t.isActive());
    if (activeTool) return activeTool.labelKey;
    if (this.placingComponent()) return 'toolBar.placeComponent';
    return null;
  });

  protected toggleParts(): void {
    this.mobileUi.toggle('palette');
  }

  protected openPorts(): void {
    this.mobileUi.open('ports');
  }
}
