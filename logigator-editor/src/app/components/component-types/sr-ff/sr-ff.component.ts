import { Component } from '../../component';
import { srFfMeta } from '@logigator/core';
import { srFfComponentConfig, SrFfOptions } from './sr-ff.config';

export class SrFfComponent extends Component<SrFfOptions> {
  public readonly config = srFfComponentConfig;

  constructor(options: SrFfOptions) {
    super(srFfMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return srFfComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
