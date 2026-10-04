import { Component } from '../../component';
import { muxMeta } from '@logigator/core';
import { muxComponentConfig, MuxOptions } from './mux.config';

export class MuxComponent extends Component<MuxOptions> {
  public readonly config = muxComponentConfig;

  constructor(options: MuxOptions) {
    super(muxMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return muxComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
