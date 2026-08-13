import { Component } from '../../component';
import { romMeta } from '@logigator/core';
import { romComponentConfig, RomOptions } from './rom.config';

export class RomComponent extends Component<RomOptions> {
  public readonly config = romComponentConfig;

  constructor(options: RomOptions) {
    super(romMeta, options);

    // Supply the contents option with the editing dimensions so the hex editor
    // knows the table shape. The ROM-specific `2^addressSize` mapping lives here
    // (not in the generic option), and doing it in the constructor — not the
    // config — keeps the link alive across every clone path, which rebuilds
    // options and runs this constructor.
    this.options.data.attachDimensions(
      () => this.options.wordSize.value,
      () => 1 << this.options.addressSize.value
    );
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return romComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(3, Math.max(this.numInputs, this.numOutputs));
  }
}
