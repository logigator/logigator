import { Component, ComponentGeometrySource } from '../component';
import { ComponentConfig } from '../component-config.model';
import { CustomComponentOptions } from './custom-component.config';
import {
  CUSTOM_BODY_GRID_WIDTH,
  CustomComponentDefinition,
  defaultBodyHeight
} from '@logigator/core';

/**
 * A custom component's definition *is* its meta. The counts are frozen at
 * snapshot time and an instance carries no options, so these ignore the option
 * values and read `def`.
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
 * The one rendering class behind every custom component type: a chamfered
 * black box carrying the definition's symbol, ports and labels. Each config's
 * `create` injects the matching definition, so nothing is subclassed per type.
 *
 * A placed instance always wraps a frozen snapshot, so it renders from fixed
 * values and does not react to master edits; bringing it up to date is an
 * explicit replace, not live propagation.
 */
export class CustomComponent extends Component<CustomComponentOptions> {
  public readonly config: ComponentConfig<CustomComponentOptions>;

  // Set after super(), so undefined during the base constructor's initial
  // draw. Every read guards for that.
  private readonly _def: CustomComponentDefinition | undefined;

  constructor(
    options: CustomComponentOptions,
    def: CustomComponentDefinition,
    config: ComponentConfig<CustomComponentOptions>
  ) {
    super(geometryOf(def), options);
    this._def = def;
    this.config = config;

    // The base constructor's initial draw ran without `_def` and so without
    // the symbol; redraw to add it.
    this.redraw();
  }

  /** The frozen snapshot definition this instance renders from. */
  public get definition(): CustomComponentDefinition {
    return this._def!;
  }

  // Null during the base constructor's draw; the redraw there adds it.
  protected override get symbol(): string | null {
    return this._def?.symbol ?? null;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
