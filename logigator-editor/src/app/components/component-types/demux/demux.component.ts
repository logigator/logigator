import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { demuxComponentConfig, DemuxOptions } from './demux.config';

export class DemuxComponent extends Component<DemuxOptions> {
  public readonly config = demuxComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: DemuxOptions) {
    super(
      options.selectLines.value + 1,
      1 << options.selectLines.value,
      options
    );

    this.options.selectLines.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.numInputs = this.options.selectLines.value + 1;
        this.numOutputs = 1 << this.options.selectLines.value;
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return demuxComponentConfig.symbol;
  }

  // Data input first, then the select lines (engine pin order).
  protected get inputLabels(): string[] {
    const labels = ['I'];
    for (let i = 0; i < this.numInputs - 1; i++) {
      labels.push(`S${i}`);
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
