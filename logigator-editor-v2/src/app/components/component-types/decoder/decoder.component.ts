import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { decoderComponentConfig, DecoderOptions } from './decoder.config';

export class DecoderComponent extends Component<DecoderOptions> {
  public readonly config = decoderComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: DecoderOptions) {
    super(
      options.numInputs.value,
      1 << options.numInputs.value,
      options.direction.value,
      options
    );

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    this.options.numInputs.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = this.options.numInputs.value;
        this.numOutputs = 1 << this.options.numInputs.value;
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return decoderComponentConfig.symbol;
  }

  // Each input line carries the bit of its power-of-two place value.
  protected get inputLabels(): string[] {
    const labels = [];
    for (let i = 0; i < this.numInputs; i++) {
      labels.push(String(1 << i));
    }
    return labels;
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

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
