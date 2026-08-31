import { ComponentConfig, LocalizableText } from '../component-config.model';
import { ComponentCategory, CustomComponentDefinition } from '@logigator/core';
import { ComponentOption } from '../component-option';
import { CustomComponent } from './custom-component';
import { SubCircuitWatch } from './sub-circuit-watch';
import { EditComponentAction } from './actions/edit-component.component-action';
import { EditDetailsAction } from './actions/edit-details.component-action';
import { UpdateInstanceComponentAction } from './actions/update-instance.component-action';
import { UpdateAllInstancesComponentAction } from './actions/update-all-instances.component-action';
import { UploadComponentAction } from './actions/upload-component.component-action';
import { ShareComponentAction } from './actions/share-component.component-action';
import { DeleteComponentAction } from './actions/delete-component.component-action';

/**
 * A custom component's port counts come from its definition, never from the
 * element, so an instance carries no options at all.
 */
export type CustomComponentOptions = Record<string, ComponentOption>;

/**
 * One config per definition, resolved through the same `getComponent(t)` path
 * as built-ins. Master configs are `USER` and populate the palette; snapshot
 * configs are `HIDDEN` — resolvable but never listed, since you place *from*
 * a master and a project's types reference snapshots.
 *
 * The config is a live view of its definition, so a master's edits surface in
 * the palette without rebuilding it. `create` closes over both `def` and the
 * config, so a built instance exposes this exact object — hence
 * `component.config.type === def.typeId`, which the serializer relies on.
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
    // Live, so the palette tile's cloud/local indicator tracks a promotion.
    get source(): 'server' | 'browser' {
      return def.source;
    },
    // User-authored, so shown verbatim rather than resolved as keys.
    get name(): LocalizableText {
      return { literal: def.name };
    },
    get description(): LocalizableText {
      return { literal: def.description };
    },
    options: {},
    // Live like the fields above, so an instance placed from an edited master
    // reports the master's current arity.
    get defaultPorts(): { inputs: number; outputs: number } {
      return { inputs: def.numInputs, outputs: def.numOutputs };
    },
    // Each action gates its own visibility. Edit, details, upload, share and
    // delete are config-scoped, so they surface on a placed instance and on a
    // palette selection alike, but details and delete need a resolving master;
    // the two update actions appear only while something is outdated.
    actions: [
      new UpdateInstanceComponentAction(),
      new UpdateAllInstancesComponentAction(),
      new EditComponentAction(),
      new EditDetailsAction(),
      new UploadComponentAction(),
      new ShareComponentAction(),
      new DeleteComponentAction()
    ],
    inspection: (component) =>
      new SubCircuitWatch(component as CustomComponent),
    create: (options) => new CustomComponent(options, def, config)
  };
  return config;
}
