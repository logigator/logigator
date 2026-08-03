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
import { Direction } from '../../utils/direction';
import { normalizeRotationSteps } from '../../utils/rotation';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { CUSTOM_TYPE_ID_BASE } from '../../components/component-type.enum';
import {
  SourceIndicatorComponent,
  SourceIndicatorState
} from '../source-indicator/source-indicator.component';

// Choices for the universal direction row, in the clockwise-from-East order
// the Direction enum encodes.
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
  // Clamp to the host container so a long, unbreakable description word can't
  // inflate the card's min-content and push it past the layout's width cap
  // (the desktop corner's max-width wrapper or the mobile settings drawer).
  host: { class: 'block max-w-full' }
})
export class ComponentSettingsComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly inspector = inject(SelectionInspectorService);
  private readonly projectService = inject(ProjectService);
  private readonly translation = inject(TranslationService);
  private readonly registry = inject(CustomComponentRegistry);

  // The settings panel shows the placement ghost while placing, otherwise the
  // single selected placed component. Each branch supplies a `commit`
  // callback that a renderer invokes on edit: the ghost writes its option
  // directly (the eventual AddComponentsAction captures the final values); a
  // placed component routes the write through ChangeOptionAction (undoable +
  // dirty-tracked). Direction is not an option but universal first-class
  // component state, so each branch also supplies the fixed direction row's
  // value and its own `commitDirection`. Both branches carry the config's
  // inspector actions and a context to act on; the ghost has no instance, so
  // its context omits component/project and instance-scoped actions (e.g.
  // update-to-latest) hide themselves on the null component.
  protected readonly componentSettings = computed(() => {
    // Hidden during simulation: editing is locked, and the mode switch has
    // already cleared selection and placement state anyway.
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
        // The ghost's direction is the sticky per-type placement direction:
        // the live hover ghost is rebuilt from it whenever the pointer
        // re-enters the board, so the panel write lands on the next ghost.
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
        // A direction change rotates about the component's midpoint, matching
        // the rotate buttons/shortcuts, rather than pinning the body's
        // top-left corner (the `direction` setter's own anchor). Routing
        // through the shared selection-rotate command reuses the buttons'
        // pivot, collision handling, and undo entry — the single selected
        // component this panel edits is exactly the selection that command
        // turns.
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

  // Inspector-hidden options (e.g. a plug's system-managed `index`) still
  // round-trip through the wire format but are never rendered in the form.
  // Each row binds the option to its renderer plus a `commit` bound to the
  // option's key, so the renderer reports edits without knowing how they apply.
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
  protected readonly directionInputId = `component-settings-direction-${++nextDirectionInputId}`;

  /**
   * The library/state chip for a custom component (master or placed snapshot):
   * its master's `server`/`browser` library when resolvable, or `embedded` when
   * the master is gone but the circuit still rides in the document (an orphan).
   * `null` for built-ins. Reads the registry revision so the chip re-resolves
   * after an upload-to-cloud flips the source or a restore re-links an orphan.
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
