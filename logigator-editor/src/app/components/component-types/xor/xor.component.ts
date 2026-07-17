import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { xorComponentConfig, XorOptions } from './xor.config';

export class XorComponent extends Component<XorOptions> {
  public readonly config = xorComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: XorOptions) {
    super(options.numInputs.value, 1, options);

    this.options.numInputs.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = this.options.numInputs.value;
      });
  }

  protected override get symbol(): string {
    return xorComponentConfig.symbol;
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
