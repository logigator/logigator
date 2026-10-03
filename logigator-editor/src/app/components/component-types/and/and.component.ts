import { Component } from '../../component';
import { andMeta } from '@logigator/core';
import { andComponentConfig, AndOptions } from './and.config';

export class AndComponent extends Component<AndOptions> {
  public readonly config = andComponentConfig;

  constructor(options: AndOptions) {
    super(andMeta, options);
  }

  protected override get symbol(): string {
    return andComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(2, Math.max(this.numInputs, this.numOutputs));
  }
}
