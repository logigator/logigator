import { Component } from '../../component';
import {
  halfAdderComponentConfig,
  HalfAdderOptions
} from './half-adder.config';

export class HalfAdderComponent extends Component<HalfAdderOptions> {
  public readonly config = halfAdderComponentConfig;

  constructor(options: HalfAdderOptions) {
    super(2, 2, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return halfAdderComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['A', 'B'];
  }

  protected get outputLabels(): string[] {
    return ['S', 'C'];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 3;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
