import { Component } from '../../component';
import { inputMeta } from '@logigator/core';
import { inputComponentConfig, InputOptions } from './input.config';

export class InputComponent extends Component<InputOptions> {
  public readonly config = inputComponentConfig;

  constructor(options: InputOptions) {
    // A plug's port counts are fixed: an INPUT exposes exactly one output.
    // The `i`/`o` wire fields are ignored on load.
    super(inputMeta, options);
  }

  // The user-set port name takes the body's centre, falling back to the "IN"
  // glyph while unnamed. Module-level config: evaluated before the `config`
  // field is assigned.
  protected override get symbol(): string {
    return this.options.label.value || inputComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(1, 1);
  }
}
