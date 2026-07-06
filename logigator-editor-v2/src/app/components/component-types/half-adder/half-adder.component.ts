import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { halfAdderComponentConfig, HalfAdderOptions } from './half-adder.config';

export class HalfAdderComponent extends Component<HalfAdderOptions> {
  public readonly config = halfAdderComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: HalfAdderOptions) {
    super(2, 2, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return halfAdderComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['A', 'B'];
  }

  protected get outputLabels(): string[] {
    return ['S', 'C'];
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
