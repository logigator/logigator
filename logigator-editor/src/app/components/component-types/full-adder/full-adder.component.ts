import { Component } from '../../component';
import { fullAdderMeta } from '@logigator/core';
import {
  fullAdderComponentConfig,
  FullAdderOptions
} from './full-adder.config';

export class FullAdderComponent extends Component<FullAdderOptions> {
  public readonly config = fullAdderComponentConfig;

  constructor(options: FullAdderOptions) {
    super(fullAdderMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return fullAdderComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
