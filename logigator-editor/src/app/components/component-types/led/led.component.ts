import { Graphics } from 'pixi.js';
import { ledMeta } from '@logigator/core';
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

  // Assigned in draw(). The class-field define runs after the base
  // constructor's first draw and resets this to undefined, so a state change
  // before the next rebuild falls back to a full redraw.
  private _disc?: Graphics;

  constructor(options: LedOptions) {
    super(ledMeta, options);
  }

  // The lit state lives in the base's powered-port set and renders as a pure
  // tint: the per-frame blink path must never redraw, which would force a
  // render-group instruction rebuild.
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

  protected draw(): void {
    const disc = new Graphics(
      this.geometryService.getGraphicsContext(LedGraphics)
    );
    this._disc = disc;
    // Draw-time setup and theme restyles; the blink path writes the tint
    // directly in setPortPowered.
    this.onApplyTheme(() => (disc.tint = this._discTint()));
    this.addChild(disc);
  }
}
