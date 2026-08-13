import { Component, ComponentGeometrySource } from '../component';
import { ComponentConfig } from '../component-config.model';
import { CustomComponentOptions } from './custom-component.config';
import {
  CUSTOM_BODY_GRID_WIDTH,
  CustomComponentDefinition,
  defaultBodyHeight
} from '@logigator/core';

/**
 * A custom component needs no `ComponentMeta`: its definition *is* that data.
 * The counts are frozen at snapshot time and an instance carries no options, so
 * every function here ignores them and reads `def`.
 */
function geometryOf(def: CustomComponentDefinition): ComponentGeometrySource {
  const ports = { inputs: def.numInputs, outputs: def.numOutputs };
  return {
    ports: () => ports,
    labels: () => ({
      inputs: def.labels.slice(0, def.numInputs),
      outputs: def.labels.slice(def.numInputs)
    }),
    // A fixed body width, independent of how wide the symbol renders.
    body: () => ({
      width: CUSTOM_BODY_GRID_WIDTH,
      height: defaultBodyHeight(ports)
    })
  };
}

/**
 * The single rendering class backing **every** custom component type: a
 * chamfered black box carrying the definition's symbol, with port stubs and
 * labels taken from the definition. The per-definition `ComponentConfig`'s
 * `create` factory injects the matching {@link CustomComponentDefinition}, so
 * no per-definition subclassing is needed.
 *
 * A placed instance always wraps a **frozen snapshot** definition, so it renders
 * from fixed values and does **not** react to master edits — bringing it up to
 * date is an explicit replace (`UpdateInstanceAction`), not live propagation.
 */
export class CustomComponent extends Component<CustomComponentOptions> {
  public readonly config: ComponentConfig<CustomComponentOptions>;

  // Set after super(), so it is undefined during the base constructor's initial
  // draw. Every read guards for that.
  private readonly _def: CustomComponentDefinition | undefined;

  constructor(
    options: CustomComponentOptions,
    def: CustomComponentDefinition,
    config: ComponentConfig<CustomComponentOptions>
  ) {
    // Port counts, labels and body all come from the definition, never the
    // element.
    super(geometryOf(def), options);
    this._def = def;
    this.config = config;

    // The base constructor's initial draw runs without `_def`, so it omits the
    // symbol. Redraw now that `_def` is set to add it. The snapshot is frozen,
    // so nothing reacts after this.
    this.redraw();
  }

  /** The frozen snapshot definition this instance renders from. */
  public get definition(): CustomComponentDefinition {
    return this._def!;
  }

  // Null during the base constructor's draw — the constructor's redraw()
  // adds the symbol once `_def` is assigned.
  protected override get symbol(): string | null {
    return this._def?.symbol ?? null;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
