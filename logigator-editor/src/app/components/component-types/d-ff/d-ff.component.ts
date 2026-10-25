import { Component } from '../../component';
import { dFfMeta } from '@logigator/core';
import { dFfComponentConfig, DFfOptions } from './d-ff.config';

export class DFfComponent extends Component<DFfOptions> {
  public readonly config = dFfComponentConfig;

  constructor(options: DFfOptions) {
    super(dFfMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return dFfComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
