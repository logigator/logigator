import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import {
  ComponentConfig,
  LocalizableText,
  resolveLocalizableText
} from '../../../components/component-config.model';
import { TranslocoService } from '@jsverse/transloco';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { MobileUiService } from '../../../layout/mobile-ui.service';

@Component({
  selector: 'app-component-list-category',
  imports: [],
  templateUrl: './component-list-category.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComponentListCategoryComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly translocoService = inject(TranslocoService);
  private readonly mobileUi = inject(MobileUiService);

  /** The palette tiles to render; already filtered by the parent's search. */
  public components = input<ComponentConfig[]>([]);

  /** Resolves display text: translates a key, returns a literal verbatim. */
  protected text(value: LocalizableText): string {
    return resolveLocalizableText(value, (key) =>
      this.translocoService.translate(key)
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
    this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
    this.workModeService.setSelectedComponentType(component.type);
    // On mobile the palette is a sheet; picking from it dismisses it so the
    // canvas is clear for placement. A no-op on desktop (no sheet is open).
    this.mobileUi.close();
  }
}
