import { Component, computed, inject } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { BuiltInComponentType } from '../../components/component-type.enum';
import { createWorkModeTools } from '../../work-mode/work-mode-tools';
import { MobileUiService } from '../../layout/mobile-ui.service';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { OnboardTargetDirective } from '../../onboarding/onboard-target.directive';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * Floating mode HUD for `isCompact`: one always-visible row with every tool
 * (pan / wire / select / erase / text) plus the Parts button and, in a
 * custom-component editor, the Ports sheet. Renders from the same
 * `createWorkModeTools` descriptors as the desktop tool bar, so the two
 * surfaces never diverge.
 */
@Component({
  selector: 'app-tool-hud',
  imports: [LgButton, TranslateDirective, OnboardTargetDirective],
  templateUrl: './tool-hud.component.html'
})
export class ToolHudComponent {
  private readonly workModeService = inject(WorkModeService);
  protected readonly mobileUi = inject(MobileUiService);
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);

  protected readonly tools = createWorkModeTools(this.workModeService);

  /** True while the active tab is a custom-component editor — the desktop side
   *  bar shows the Ports panel here; the HUD exposes it as an extra button. */
  protected readonly isEditingComponent = computed(() => {
    const active = this.projectService.activeProject();
    return !!active && this.metadataStore.getMetadata(active)?.type === 'comp';
  });

  /**
   * Placing a palette component (the Parts flow) — TEXT excluded, since it has
   * its own tool button that lights up instead.
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
