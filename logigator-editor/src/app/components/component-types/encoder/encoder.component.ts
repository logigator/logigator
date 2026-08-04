import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { encoderComponentConfig, EncoderOptions } from './encoder.config';

export class EncoderComponent extends Component<EncoderOptions> {
  public readonly config = encoderComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: EncoderOptions) {
    super(1 << options.numOutputs.value, options.numOutputs.value, options);

    this.options.numOutputs.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = 1 << this.options.numOutputs.value;
        this.numOutputs = this.options.numOutputs.value;
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return encoderComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    const labels = [];
    for (let i = 0; i < this.numInputs; i++) {
      labels.push(String(i));
    }
    return labels;
  }

  // Each output line carries the bit of its power-of-two place value.
  protected get outputLabels(): string[] {
    const labels = [];
    for (let i = 0; i < this.numOutputs; i++) {
      labels.push(String(1 << i));
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
