import { Component } from '../../component';
import { clockComponentConfig, ClockOptions } from './clock.config';

export class ClockComponent extends Component<ClockOptions> {
  public readonly config = clockComponentConfig;

  constructor(options: ClockOptions) {
    super(1, 1, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return clockComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['STP'];
  }

  protected get outputLabels(): string[] {
    return ['CLK'];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 3;
  }

  // The body is one row taller than its single port row, giving the symbol its
  // own line below the labels (legacy geometry, mirrored by the frozen
  // LEGACY_MIN_BODY_HEIGHTS entry).
  protected override get bodyGridHeight(): number {
    return 2;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
