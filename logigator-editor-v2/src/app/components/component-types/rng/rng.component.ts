import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { rngComponentConfig, RngOptions } from './rng.config';

export class RngComponent extends Component<RngOptions> {
  public readonly config = rngComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: RngOptions) {
    super(1, options.numOutputs.value, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    this.options.numOutputs.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numOutputs = this.options.numOutputs.value;
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return rngComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['CLK'];
  }

  protected get outputLabels(): string[] {
    const labels = [];
    for (let i = 0; i < this.numOutputs; i++) {
      labels.push(String(i));
    }
    return labels;
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 3;
  }

  // At least two rows tall so the symbol keeps its own line beside the single
  // CLK input (legacy geometry, mirrored by the frozen LEGACY_MIN_BODY_HEIGHTS
  // entry).
  protected override get bodyGridHeight(): number {
    return Math.max(2, this.numInputs, this.numOutputs);
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
