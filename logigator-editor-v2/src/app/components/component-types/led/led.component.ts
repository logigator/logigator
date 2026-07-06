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

  // Assigned in draw(); the class-field define runs after the base
  // constructor's first draw and resets it to undefined, so a state change
  // arriving before the next rebuild falls back to a full redraw.
  private _disc?: Graphics;

  constructor(options: LedOptions) {
    super(1, 0, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });
  }

  // The lit state lives in the base's powered-port set (survives redraws) and
  // renders as a pure tint on the white disc — the per-frame blink path must
  // never redraw, which would force a render-group instruction rebuild.
  public override setPortPowered(portIndex: number, powered: boolean): void {
    const wasLit = this.isPortPowered(0);
    super.setPortPowered(portIndex, powered);
    if (this.isPortPowered(0) === wasLit) {
      return;
    }
    if (this._disc) {
      this._disc.tint = this._discTint();
    } else {
      this.redraw();
    }
  }

  private _discTint(): number {
    const theme = this.themingService.currentTheme();
    return this.isPortPowered(0) ? theme.ledOn : theme.ledOff;
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
      this.geometryService.getGraphicsContext(LedGraphics)
    );
    disc.tint = this._discTint();
    this._disc = disc;
    this.addChild(disc);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
