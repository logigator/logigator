import { Component } from '../../component';
import { dFfComponentConfig, DFfOptions } from './d-ff.config';

export class DFfComponent extends Component<DFfOptions> {
  public readonly config = dFfComponentConfig;

  constructor(options: DFfOptions) {
    super(2, 2, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return dFfComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['D', 'CLK'];
  }

  protected get outputLabels(): string[] {
    return ['Q', '!Q'];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 3;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
