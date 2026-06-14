import { Component } from '../../component';
import { romComponentConfig, RomOptions } from './rom.config';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';

export class RomComponent extends Component<RomOptions> {
  public readonly config = romComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: RomOptions) {
    super(
      options.addressSize.value,
      options.wordSize.value,
      options.direction.value,
      options
    );

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    this.options.addressSize.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = this.options.addressSize.value;
      });

    this.options.wordSize.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numOutputs = this.options.wordSize.value;
      });
  }

  protected get inputLabels(): string[] {
    const labels = [];
    for (let i = 1; i <= this.numInputs; i++) {
      labels.push(`A${i}`);
    }
    return labels;
  }

  protected get outputLabels(): string[] {
    const labels = [];
    for (let i = 1; i <= this.numOutputs; i++) {
      labels.push(`O${i}`);
    }
    return labels;
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 3;
  }

  protected draw(): void {
    this.addBody(3, Math.max(this.numInputs, this.numOutputs));
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
