import { Component } from '../../component';
import { rngMeta } from '@logigator/core';
import { rngComponentConfig, RngOptions } from './rng.config';

export class RngComponent extends Component<RngOptions> {
  public readonly config = rngComponentConfig;

  constructor(options: RngOptions) {
    super(rngMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return rngComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
