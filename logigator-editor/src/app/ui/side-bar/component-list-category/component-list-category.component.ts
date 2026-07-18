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

@Component({
  selector: 'app-component-list-category',
  imports: [SourceIndicatorComponent, OnboardTargetDirective],
  templateUrl: './component-list-category.component.html'
})
export class ComponentListCategoryComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly translation = inject(TranslationService);
  private readonly mobileUi = inject(MobileUiService);

  /** The palette tiles to render; already filtered by the parent's search. */
  public components = input<ComponentConfig[]>([]);

  /** Resolves display text: translates a key, returns a literal verbatim. */
  protected text(value: LocalizableText): string {
    return resolveLocalizableText(value, (key) =>
      this.translation.translate(key)
    );
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

  /** Arms the component for placement (sticky until another tool is chosen). */
  public selectComponent(component: ComponentConfig): void {
    // Arm placement only. A cloud master's circuit is fetched lazily when the
    // component is actually placed on the canvas (see WorkModeRouter), not while
    // it is merely browsed/armed in the palette.
    this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
    this.workModeService.setSelectedComponentType(component.type);
    // On mobile the palette is a sheet; picking from it dismisses it so the
    // canvas is clear for placement. A no-op on desktop (no sheet is open).
    this.mobileUi.close();
  }
}
