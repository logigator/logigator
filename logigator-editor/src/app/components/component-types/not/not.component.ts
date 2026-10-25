import { Component } from '../../component';
import { notMeta } from '@logigator/core';
import { notComponentConfig, NotOptions } from './not.config';

export class NotComponent extends Component<NotOptions> {
  public readonly config = notComponentConfig;

  constructor(options: NotOptions) {
    super(notMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return notComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(2, Math.max(this.numInputs, this.numOutputs));
  }
}
