import { Component } from '../../component';
import { outputComponentConfig, OutputOptions } from './output.config';

export class OutputComponent extends Component<OutputOptions> {
  public readonly config = outputComponentConfig;

  constructor(options: OutputOptions) {
    // A plug's port counts are fixed: an OUTPUT exposes exactly one input
    // (the signal it draws out of the circuit). The `i`/`o` wire fields are
    // ignored on load — counts come from here, not from the element.
    super(1, 0, options);
  }

  // A 1×1 plug is symbol-only: the centered "OUT" glyph fills the body, so the
  // per-stub label path (which draws labels *inside* the body) would overlap
  // it. The port name is surfaced via click-to-name and the Ports panel
  // instead.
  protected get inputLabels(): string[] {
    return [];
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 1;
  }

  protected override get symbol(): string {
    return outputComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(1, 1);
  }
}
