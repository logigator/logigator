import { Component } from '../../component';
import { ramMeta } from '@logigator/core';
import { ramComponentConfig, RamOptions } from './ram.config';

export class RamComponent extends Component<RamOptions> {
  public readonly config = ramComponentConfig;

  constructor(options: RamOptions) {
    super(ramMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return ramComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
