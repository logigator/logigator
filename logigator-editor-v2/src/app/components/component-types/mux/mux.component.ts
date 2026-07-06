import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { muxComponentConfig, MuxOptions } from './mux.config';

export class MuxComponent extends Component<MuxOptions> {
  public readonly config = muxComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: MuxOptions) {
    super(
      options.selectLines.value + (1 << options.selectLines.value),
      1,
      options.direction.value,
      options
    );

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    this.options.selectLines.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs =
          this.options.selectLines.value +
          (1 << this.options.selectLines.value);
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return muxComponentConfig.symbol;
  }

  // Select lines first, then the 2^n data inputs (engine pin order).
  protected get inputLabels(): string[] {
    const selects = this.options.selectLines.value;
    const labels = [];
    for (let i = 0; i < selects; i++) {
      labels.push(`S${i}`);
    }
    for (let i = 0; i < this.numInputs - selects; i++) {
      labels.push(String(i));
    }
    return labels;
  }

  protected get outputLabels(): string[] {
    return [];
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
