import { Component } from '../../component';
import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { tunnelComponentConfig, TunnelOptions } from './tunnel.config';

export class TunnelComponent extends Component<TunnelOptions> {
  public readonly config = tunnelComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: TunnelOptions) {
    super(1, 0, options);

    // The label renders beside the port stub, so a rename needs a rebuild of
    // the visual tree (ports themselves are unaffected).
    this.options.label.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.redraw();
      });
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return tunnelComponentConfig.symbol;
  }

  protected get inputLabels(): string[] {
    return [this.options.label.value];
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 2;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
