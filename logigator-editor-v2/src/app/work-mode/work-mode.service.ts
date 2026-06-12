import { computed, inject, Injectable, signal } from '@angular/core';
import { WorkMode } from './work-mode.enum';
import { ComponentType } from '../components/component-type.enum';
import { ComponentProviderService } from '../components/component-provider.service';

@Injectable({
  providedIn: 'root'
})
export class WorkModeService {
  private readonly componentProviderService = inject(ComponentProviderService);

  private readonly _mode = signal<WorkMode>(WorkMode.WIRE_DRAWING);
  public readonly mode = computed(this._mode);

  private readonly _selectedComponentType = signal<ComponentType | null>(null);
  public readonly selectedComponentType = computed(this._selectedComponentType);

  public readonly selectedComponentConfig = computed(() => {
    const componentType = this.selectedComponentType();
    return componentType !== null
      ? (this.componentProviderService.getComponent(componentType) ?? null)
      : null;
  });

  public setMode(mode: WorkMode): void {
    if (mode === WorkMode.SIMULATION) {
      throw new Error(
        'Simulation mode is entered via SimulationService.enter()'
      );
    }
    if (this._mode() === WorkMode.SIMULATION) {
      return; // editing is locked while a simulation runs
    }
    if (mode !== WorkMode.COMPONENT_PLACEMENT) {
      this.setSelectedComponentType(null);
    }

    this._mode.set(mode);
  }

  /** The simulation lifecycle's only doorway past the editing lock above. */
  public setSimulationMode(simulating: boolean): void {
    this._selectedComponentType.set(null);
    this._mode.set(simulating ? WorkMode.SIMULATION : WorkMode.SELECT);
  }

  public setSelectedComponentType(componentType: ComponentType | null): void {
    if (this._mode() === WorkMode.SIMULATION) {
      return;
    }
    this._selectedComponentType.set(componentType);
  }
}
