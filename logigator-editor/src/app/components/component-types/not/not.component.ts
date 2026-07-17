import { Component } from '../../component';
import { notComponentConfig, NotOptions } from './not.config';

export class NotComponent extends Component<NotOptions> {
  public readonly config = notComponentConfig;

  constructor(options: NotOptions) {
    super(1, 1, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return notComponentConfig.symbol;
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
