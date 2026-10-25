import { Component } from '../../component';
import { delayMeta } from '@logigator/core';
import { delayComponentConfig, DelayOptions } from './delay.config';

export class DelayComponent extends Component<DelayOptions> {
  public readonly config = delayComponentConfig;

  constructor(options: DelayOptions) {
    super(delayMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return delayComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(2, Math.max(this.numInputs, this.numOutputs));
  }
}
