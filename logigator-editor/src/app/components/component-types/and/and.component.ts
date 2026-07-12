import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { andComponentConfig, AndOptions } from './and.config';

export class AndComponent extends Component<AndOptions> {
  public readonly config = andComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: AndOptions) {
    super(options.numInputs.value, 1, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    this.options.numInputs.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = this.options.numInputs.value;
      });
  }

  protected override get symbol(): string {
    return andComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return [];
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 2;
  }

  protected draw(): void {
    this.addBody(2, Math.max(this.numInputs, this.numOutputs));
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
