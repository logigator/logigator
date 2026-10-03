import { Component, computed, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LgSelectButton } from '@logigator/ui';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { SelectionInspectorService } from '../../project/selection-inspector.service';
import { ProjectService } from '../../project/project.service';
import { LgCard } from '@logigator/ui';
import {
  LocalizableText,
  resolveLocalizableText
} from '../../components/component-config.model';
import { TranslationService } from '../../translation/translation.service';
import { ChangeOptionAction } from '../../actions/actions/change-option.action';
import { CUSTOM_TYPE_ID_BASE, Direction } from '@logigator/core';
import { normalizeRotationSteps } from '../../utils/rotation';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import {
  SourceIndicatorComponent,
  SourceIndicatorState
} from '../source-indicator/source-indicator.component';

// Clockwise from East, the order the Direction enum encodes.
const DIRECTION_CHOICES: { value: Direction; icon: string }[] = [
  { value: Direction.E, icon: 'ph ph-arrow-fat-right' },
  { value: Direction.S, icon: 'ph ph-arrow-fat-down' },
  { value: Direction.W, icon: 'ph ph-arrow-fat-left' },
  { value: Direction.N, icon: 'ph ph-arrow-fat-up' }
];

let nextDirectionInputId = 0;

@Component({
  selector: 'app-component-settings',
  imports: [
    NgComponentOutlet,
    FormsModule,
    LgCard,
    LgSelectButton,
    SourceIndicatorComponent
  ],
  templateUrl: './component-settings.component.html',
  // Clamped so a long unbreakable description word can't inflate the card's
  // min-content and push it past the layout's width cap.
  host: { class: 'block max-w-full' }
})
export class ComponentSettingsComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly inspector = inject(SelectionInspectorService);
  private readonly projectService = inject(ProjectService);
  private readonly translation = inject(TranslationService);
  private readonly registry = inject(CustomComponentRegistry);

  // The placement ghost while placing, otherwise the single selected placed
  // component. Each branch supplies the `commit` a renderer invokes on edit:
  // the ghost writes its option directly, since the eventual
  // AddComponentsAction captures the final values, while a placed component
  // routes through ChangeOptionAction so the edit is undoable and dirty-
  // tracked. Direction is first-class state rather than an option, hence the
  // separate `commitDirection`. The ghost has no instance, so its context
  // omits component/project and instance-scoped actions hide themselves.
  protected readonly componentSettings = computed(() => {
    // Hidden during simulation: editing is locked and the mode switch has
    // already cleared selection and placement state.
    if (this.workModeService.mode() === WorkMode.SIMULATION) {
      return null;
    }

    const ghost = this.workModeService.selectedComponentConfig();
    if (ghost) {
      return {
        name: ghost.name,
        description: ghost.description,
        options: ghost.options,
        commit: (key: string, value: unknown) => {
          ghost.options[key].value = value;
        },
        // The sticky per-type placement direction: the hover ghost is rebuilt
        // from it whenever the pointer re-enters the board, so a write here
        // lands on the next ghost.
        direction: this.workModeService.placementDirectionFor(ghost.type),
        commitDirection: (value: Direction) =>
          this.workModeService.setPlacementDirection(ghost.type, value),
        actions: ghost.actions ?? [],
        context: { config: ghost, component: null, project: null },
        source: this._customSource(ghost.type)
      };
    }

    const selected = this.inspector.selectedComponent();
    const project = this.projectService.activeProject();
    if (selected && project) {
      return {
        name: selected.config.name,
        description: selected.config.description,
        options: selected.options,
        commit: (key: string, value: unknown) => {
          const option = selected.options[key];
          if (option.value === value) return;
          project.actionManager.push(
            new ChangeOptionAction(selected.id, key, option.value, value)
          );
        },
        direction: selected.direction,
        // Rotates about the component's midpoint rather than pinning the
        // body's top-left corner, which is the `direction` setter's own
        // anchor. The shared selection-rotate command already has that pivot
        // plus collision handling and one undo entry.
        commitDirection: (value: Direction) => {
          const steps = normalizeRotationSteps(value - selected.direction);
          if (steps === 0) return;
          project.requestSelectionRotation(steps);
        },
        actions: selected.config.actions ?? [],
        context: { config: selected.config, component: selected, project },
        source: this._customSource(selected.config.type)
      };
    }

    return null;
  });

  // Inspector-hidden options (a plug's system-managed `index`, say) still
  // round-trip through the wire format but never reach the form. Each row's
  // `commit` is bound to the option's key, so a renderer reports an edit
  // without knowing how it applies.
  protected readonly options = computed(() => {
    const settings = this.componentSettings();
    if (!settings) return [];

    return Object.entries(settings.options)
      .filter(([, option]) => !option.inspectorHidden)
      .map(([key, option]) => ({
        key,
        option,
        commit: (value: unknown) => settings.commit(key, value)
      }));
  });

  protected readonly directionChoices = DIRECTION_CHOICES;
  // Labels the direction group by reference: `<label for>` does not associate
  // with the `div[role=group]` that LgSelectButton renders.
  protected readonly directionLabelId = `component-settings-direction-${++nextDirectionInputId}`;

  /**
   * The library chip for a custom component: its master's `server`/`browser`
   * library when resolvable, `embedded` when the master is gone but the circuit
   * still rides in the document, `null` for built-ins. Reads the registry
   * revision so the chip re-resolves when a source flips or an orphan re-links.
   */
  private _customSource(typeId: number): SourceIndicatorState | null {
    this.registry.revision();
    if (typeId < CUSTOM_TYPE_ID_BASE) return null;
    return this.registry.resolveMaster(typeId)?.master.source ?? 'embedded';
  }

  /** Resolves display text: translates a key, returns a literal verbatim. */
  protected text(value: LocalizableText): string {
    return resolveLocalizableText(value, (key) =>
      this.translation.translate(key)
    );
  }
}
