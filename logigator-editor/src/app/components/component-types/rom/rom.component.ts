import { Component } from '../../component';
import { romMeta } from '@logigator/core';
import { bindRomOptions, romComponentConfig, RomOptions } from './rom.config';

export class RomComponent extends Component<RomOptions> {
  public readonly config = romComponentConfig;

  constructor(options: RomOptions) {
    super(romMeta, options);
    bindRomOptions(this.options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return romComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(3, Math.max(this.numInputs, this.numOutputs));
  }
}
