import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { ramComponentConfig, RamOptions } from './ram.config';

export class RamComponent extends Component<RamOptions> {
  public readonly config = ramComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: RamOptions) {
    super(
      RamComponent._numInputs(options),
      options.wordSize.value,
      options.direction.value,
      options
    );

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    this.options.wordSize.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = RamComponent._numInputs(this.options);
        this.numOutputs = this.options.wordSize.value;
      });

    this.options.addressSize.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = RamComponent._numInputs(this.options);
      });
  }

  // Address and data lines plus the WE and CLK controls (engine pin order).
  private static _numInputs(options: RamOptions): number {
    return options.addressSize.value + options.wordSize.value + 2;
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return ramComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    const labels = [];
    for (let i = 0; i < this.options.addressSize.value; i++) {
      labels.push(`A${i}`);
    }
    for (let i = 0; i < this.options.wordSize.value; i++) {
      labels.push(`D${i}`);
    }
    labels.push('WE', 'CLK');
    return labels;
  }

  protected get outputLabels(): string[] {
    const labels = [];
    for (let i = 0; i < this.numOutputs; i++) {
      labels.push(`D${i}`);
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
