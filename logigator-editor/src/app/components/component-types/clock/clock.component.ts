import { Component } from '../../component';
import { clockMeta } from '@logigator/core';
import { clockComponentConfig, ClockOptions } from './clock.config';

export class ClockComponent extends Component<ClockOptions> {
  public readonly config = clockComponentConfig;

  constructor(options: ClockOptions) {
    super(clockMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return clockComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
