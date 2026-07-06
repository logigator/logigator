import { DestroyOptions, Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { Component } from '../../component';
import { LedGraphics } from '../../../rendering/graphics/led.graphics';
import { ledComponentConfig, LedOptions } from './led.config';

/**
 * A display-only indicator: not a simulator unit — it lights up from the
 * powered state of the net its input is attached to, applied through the
 * regular {@link Component.setPortPowered} path.
 */
export class LedComponent extends Component<LedOptions> {
  public readonly config = ledComponentConfig;

  private readonly destroy$ = new Subject<void>();

  constructor(options: LedOptions) {
    super(1, 0, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });
  }

  // The lit state lives in the base's powered-port set (survives redraws), so
  // the disc only needs a rebuild when the state actually flips.
  public override setPortPowered(portIndex: number, powered: boolean): void {
    const wasLit = this.isPortPowered(0);
    super.setPortPowered(portIndex, powered);
    if (this.isPortPowered(0) !== wasLit) {
      this.redraw();
    }
  }

  protected get inputLabels(): string[] {
    return [];
  }

  protected get outputLabels(): string[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 1;
  }

  protected draw(): void {
    const disc = new Graphics(
      this.geometryService.getGraphicsContext(LedGraphics, this.isPortPowered(0))
    );
    this.addChild(disc);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
