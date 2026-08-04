import { Component } from '../../component';
import { delayComponentConfig, DelayOptions } from './delay.config';

export class DelayComponent extends Component<DelayOptions> {
  public readonly config = delayComponentConfig;

  constructor(options: DelayOptions) {
    super(1, 1, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return delayComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return [];
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 2;
  }

  protected draw(): void {
    this.addBody(2, Math.max(this.numInputs, this.numOutputs));
  }
}
