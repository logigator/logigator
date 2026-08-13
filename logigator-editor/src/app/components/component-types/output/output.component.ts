import { Component } from '../../component';
import { outputMeta } from '@logigator/core';
import { outputComponentConfig, OutputOptions } from './output.config';

export class OutputComponent extends Component<OutputOptions> {
  public readonly config = outputComponentConfig;

  constructor(options: OutputOptions) {
    // A plug's port counts are fixed: an OUTPUT exposes exactly one input
    // (the signal it draws out of the circuit). The `i`/`o` wire fields are
    // ignored on load — counts come from here, not from the element.
    super(outputMeta, options);
  }

  // The user-set port name takes the body's centre, falling back to the "OUT"
  // glyph while unnamed (legacy-editor behavior). Module-level config: evaluated
  // before the `config` field is assigned.
  protected override get symbol(): string {
    return this.options.label.value || outputComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(1, 1);
  }
}
