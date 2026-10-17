import { Component, computed, inject, input } from '@angular/core';
import {
  ComponentConfig,
  LocalizableText,
  resolveLocalizableText
} from '../../../components/component-config.model';
import { TranslationService } from '../../../translation/translation.service';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { MobileUiService } from '../../../layout/mobile-ui.service';
import { SourceIndicatorComponent } from '../../source-indicator/source-indicator.component';
import { OnboardTargetDirective } from '../../../onboarding/onboard-target.directive';
import { ComponentSymbolComponent } from '../component-symbol/component-symbol.component';
import { OutdatedInstancesService } from '../../../custom-component/outdated-instances.service';

@Component({
  selector: 'app-component-list-category',
  imports: [
    SourceIndicatorComponent,
    OnboardTargetDirective,
    ComponentSymbolComponent
  ],
  templateUrl: './component-list-category.component.html'
})
export class ComponentListCategoryComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly translation = inject(TranslationService);
  private readonly mobileUi = inject(MobileUiService);
  private readonly outdatedInstances = inject(OutdatedInstancesService);

  /** Already filtered by the parent's search. */
  public components = input<ComponentConfig[]>([]);

  /** Resolves display text: translates a key, returns a literal verbatim. */
  protected text(value: LocalizableText): string {
    return resolveLocalizableText(value, (key) =>
      this.translation.translate(key)
    );
  }

  /**
   * How many instances of this type on the board are behind their master. A map
   * lookup into the service's single board scan, not a per-tile scan.
   */
  protected outdatedCount(typeId: number): number {
    return this.outdatedInstances.countFor(typeId);
  }

  protected outdatedTitle(count: number): string {
    return this.translation.translate('sideBar.outdatedInstances', { count });
  }

  /** The placement-armed component type, when it belongs to this list. */
  protected selectedComponent = computed(() => {
    const selectedComponent = this.workModeService.selectedComponentType();
    if (selectedComponent === null) {
      return null;
    }

    return (
      this.components().find((comp) => comp.type === selectedComponent)?.type ??
      null
    );
  });

  /** Arms the component for placement, sticky until another tool is chosen. */
  public selectComponent(component: ComponentConfig): void {
    // Arm only: a cloud master's circuit is fetched lazily when the component
    // is actually placed, not while it is browsed in the palette.
    this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
    this.workModeService.setSelectedComponentType(component.type);
    // On mobile the palette is a sheet, dismissed so the canvas is clear for
    // placement. A no-op on desktop, where no sheet is open.
    this.mobileUi.close();
  }
}
