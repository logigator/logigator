import { Component } from '../../component';
import { jkFfComponentConfig, JkFfOptions } from './jk-ff.config';

export class JkFfComponent extends Component<JkFfOptions> {
  public readonly config = jkFfComponentConfig;

  constructor(options: JkFfOptions) {
    super(3, 2, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return jkFfComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['J', 'CLK', 'K'];
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
