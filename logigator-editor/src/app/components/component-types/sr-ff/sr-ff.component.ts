import { Component } from '../../component';
import { srFfComponentConfig, SrFfOptions } from './sr-ff.config';

export class SrFfComponent extends Component<SrFfOptions> {
  public readonly config = srFfComponentConfig;

  constructor(options: SrFfOptions) {
    super(3, 2, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return srFfComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['S', 'CLK', 'R'];
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
