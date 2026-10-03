import { Component } from '../../component';
import { pulseButtonMeta } from '@logigator/core';
import { PulseButtonGraphics } from '../../../rendering/graphics/pulse-button.graphics';
import {
  pulseButtonComponentConfig,
  PulseButtonOptions
} from './pulse-button.config';

/**
 * A pulse button (simulation user input, Pulse event): a click emits a single
 * one-tick pulse on its output, however long it is held. The pressed
 * state is transient sim visuals on the instance — not an option: it is not
 * undoable and not persisted, and is cleared on simulation stop/exit.
 */
export class PulseButtonComponent extends Component<PulseButtonOptions> {
  public readonly config = pulseButtonComponentConfig;

  private _pressed = false;

  constructor(options: PulseButtonOptions) {
    super(pulseButtonMeta, options);
  }

  public get pressed(): boolean {
    // The base constructor's initial draw runs before field initializers —
    // an unassigned `_pressed` must read as unpressed.
    return this._pressed === true;
  }

  public setPressed(pressed: boolean): void {
    if (this.pressed === pressed) {
      return;
    }
    this._pressed = pressed;
    this.redraw();
  }

  public override clearSimState(): void {
    this.setPressed(false);
  }

  protected draw(): void {
    // The square pulse-button body replaces the standard chamfered body entirely.
    this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(
        PulseButtonGraphics,
        scale,
        this.pressed
      )
    );
  }
}
