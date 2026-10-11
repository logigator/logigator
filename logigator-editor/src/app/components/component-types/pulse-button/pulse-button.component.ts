import { Component } from '../../component';
import { pulseButtonMeta } from '@logigator/core';
import { PulseButtonGraphics } from '../../../rendering/graphics/pulse-button.graphics';
import { PulseUserInput } from '../../user-input';
import {
  pulseButtonComponentConfig,
  PulseButtonOptions
} from './pulse-button.config';

/**
 * A pulse button (simulation user input, Pulse event): a click emits a single
 * one-tick pulse on its output, however long it is held, and its body flashes
 * pressed. A {@link PulseUserInput} operated by `tap`, one slot.
 */
export class PulseButtonComponent
  extends Component<PulseButtonOptions>
  implements PulseUserInput
{
  public readonly config = pulseButtonComponentConfig;
  public readonly drive = 'pulse';
  public readonly gesture = 'tap';
  public readonly inputSlots = 1;

  private _pressed = false;

  constructor(options: PulseButtonOptions) {
    super(pulseButtonMeta, options);
  }

  public isActive(slot: number): boolean {
    // The base constructor's initial draw runs before field initializers —
    // an unassigned `_pressed` must read as unpressed.
    return slot === 0 && this._pressed === true;
  }

  public setActive(slot: number, pressed: boolean): void {
    if (slot !== 0 || this.isActive(0) === pressed) {
      return;
    }
    this._pressed = pressed;
    this.redraw();
  }

  public override clearSimState(): void {
    this.setActive(0, false);
  }

  protected draw(): void {
    // The square pulse-button body replaces the standard chamfered body entirely.
    this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(
        PulseButtonGraphics,
        scale,
        this.isActive(0)
      )
    );
  }
}
