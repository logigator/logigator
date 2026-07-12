import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import {
  fullAdderComponentConfig,
  FullAdderOptions
} from './full-adder.config';

export class FullAdderComponent extends Component<FullAdderOptions> {
  public readonly config = fullAdderComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: FullAdderOptions) {
    super(3, 2, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return fullAdderComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return ['A', 'B', 'Cin'];
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
