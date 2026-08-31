import { computed, inject, Injectable, signal } from '@angular/core';
import { WorkMode } from './work-mode.enum';
import { ComponentType, Direction } from '@logigator/core';
import { ComponentProviderService } from '../components/component-provider.service';
import { LoggingService } from '../logging/logging.service';

@Injectable({
  providedIn: 'root'
})
export class WorkModeService {
  private readonly componentProviderService = inject(ComponentProviderService);
  private readonly logging = inject(LoggingService);

  // Navigate-first: the board boots ready to pan, not to mutate.
  private readonly _mode = signal<WorkMode>(WorkMode.PAN);
  public readonly mode = computed(this._mode);

  private readonly _selectedComponentType = signal<ComponentType | null>(null);
  public readonly selectedComponentType = computed(this._selectedComponentType);

  public readonly selectedComponentConfig = computed(() => {
    const componentType = this.selectedComponentType();
    return componentType !== null
      ? (this.componentProviderService.getComponent(componentType) ?? null)
      : null;
  });

  // Sticky per-type placement direction, so consecutive placements keep facing
  // the way the user chose. Session-lifetime, defaulting to East.
  private readonly _placementDirections = signal<
    ReadonlyMap<ComponentType, Direction>
  >(new Map());

  /** The direction a new placement ghost of `type` starts with. */
  public placementDirectionFor(type: ComponentType): Direction {
    return this._placementDirections().get(type) ?? Direction.E;
  }

  public setPlacementDirection(type: ComponentType, value: Direction): void {
    const next = new Map(this._placementDirections());
    next.set(type, value);
    this._placementDirections.set(next);
  }

  public setMode(mode: WorkMode): void {
    if (mode === WorkMode.SIMULATION) {
      throw new Error(
        'Simulation mode is entered via SimulationService.enter()'
      );
    }
    if (this._mode() === WorkMode.SIMULATION) {
      this.logging.debug(
        `mode change to ${mode} rejected: editing is locked during simulation`,
        'WorkModeService'
      );
      return;
    }
    if (mode !== WorkMode.COMPONENT_PLACEMENT) {
      this.setSelectedComponentType(null);
    }

    this.logging.debug(`setMode ${this._mode()} → ${mode}`, 'WorkModeService');
    this._mode.set(mode);
  }

  /** The simulation lifecycle's only doorway past the editing lock above. */
  public setSimulationMode(simulating: boolean): void {
    this._selectedComponentType.set(null);
    // Leaving a simulation lands back in the navigate-first default.
    this._mode.set(simulating ? WorkMode.SIMULATION : WorkMode.PAN);
  }

  public setSelectedComponentType(componentType: ComponentType | null): void {
    if (this._mode() === WorkMode.SIMULATION) {
      this.logging.debug(
        `component-type selection ${componentType} ignored: editing is locked during simulation`,
        'WorkModeService'
      );
      return;
    }
    this._selectedComponentType.set(componentType);
  }
}
