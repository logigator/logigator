import { Component } from '../../component';
import { halfAdderMeta } from '@logigator/core';
import {
  halfAdderComponentConfig,
  HalfAdderOptions
} from './half-adder.config';

export class HalfAdderComponent extends Component<HalfAdderOptions> {
  public readonly config = halfAdderComponentConfig;

  constructor(options: HalfAdderOptions) {
    super(halfAdderMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return halfAdderComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
