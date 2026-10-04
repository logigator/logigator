import { Component } from '../../component';
import { tunnelMeta } from '@logigator/core';
import { tunnelComponentConfig, TunnelOptions } from './tunnel.config';

export class TunnelComponent extends Component<TunnelOptions> {
  public readonly config = tunnelComponentConfig;

  constructor(options: TunnelOptions) {
    super(tunnelMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return tunnelComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
