import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { dFfComponentConfig, DFfOptions } from './d-ff.config';

export class DFfComponent extends Component<DFfOptions> {
  public readonly config = dFfComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: DFfOptions) {
    super(2, 2, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return dFfComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['D', 'CLK'];
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

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
