import { ComponentConfig, LocalizableText } from '../component-config.model';
import { ComponentCategory } from '../component-category.enum';
import { ComponentOption } from '../component-option';
import { DirectionComponentOption } from '../component-options/direction/direction.component-option';
import { CustomComponentDefinition } from './custom-component-definition.model';
import { CustomComponent } from './custom-component';
import { SubCircuitWatch } from './sub-circuit-watch';
import { EditComponentAction } from './actions/edit-component.component-action';
import { UpdateInstanceComponentAction } from './actions/update-instance.component-action';
import { UploadComponentAction } from './actions/upload-component.component-action';

/**
 * Option set for every custom component instance. Unlike built-ins, a custom
 * component's port counts come from its {@link CustomComponentDefinition}, never
 * from the element — so the only per-instance option is `direction` (Invariant A
 * in the custom-components plan).
 */
export interface CustomComponentOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

/**
 * Builds the single {@link ComponentConfig} that backs a custom component type —
 * one config per definition, resolved through the same `getComponent(t)` path as
 * built-ins.
 *
 * **Master** configs are `USER` category (they populate the palette); **snapshot**
 * configs are `HIDDEN` (resolvable by `getComponent(t)` but never listed — you
 * place *from* a master, and a project's `t`s reference snapshots).
 *
 * The config is a **live view** of its definition: `symbol`/`name`/`description`
 * are getters reading `def`, so a master's edits surface in the palette without
 * rebuilding the config and a frozen snapshot's stay fixed. `create` closes over
 * both `def` and the config itself, so a built instance exposes this exact object
 * (hence `component.config.type === def.typeId`, which the serializer relies on).
 */
export function buildCustomComponentConfig(
  def: CustomComponentDefinition
): ComponentConfig<CustomComponentOptions> {
  const config: ComponentConfig<CustomComponentOptions> = {
    type: def.typeId,
    category:
      def.kind === 'master' ? ComponentCategory.USER : ComponentCategory.HIDDEN,
    get symbol(): string {
      return def.symbol;
    },
    // Live view of the definition's library, so the palette tile's cloud/local
    // indicator tracks an upload-to-cloud promotion without rebuilding the config.
    get source(): 'server' | 'browser' {
      return def.source;
    },
    // User-authored strings, shown verbatim (the literal arm of LocalizableText)
    // rather than resolved against the translation schema.
    get name(): LocalizableText {
      return { literal: def.name };
    },
    get description(): LocalizableText {
      return { literal: def.description };
    },
    options: {
      direction: new DirectionComponentOption()
    },
    // Inspector actions rendered generically by the settings panel, each gating
    // its own visibility. Edit and upload are config-scoped, so they surface on
    // both a selected placed instance and a palette/ghost selection;
    // update-to-latest hides itself unless a selected snapshot instance is behind
    // its master.
    actions: [
      new EditComponentAction(),
      new UpdateInstanceComponentAction(),
      new UploadComponentAction()
    ],
    // Tapping a placed instance during simulation opens a live watch of its
    // inner circuit.
    inspection: (component) =>
      new SubCircuitWatch(component as CustomComponent),
    create: (options) => new CustomComponent(options, def, config)
  };
  return config;
}
