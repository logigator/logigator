import { Component } from '../../component';
import { buttonMeta } from '@logigator/core';
import { ButtonGraphics } from '../../../rendering/graphics/button.graphics';
import { buttonComponentConfig, ButtonOptions } from './button.config';

/**
 * A momentary push button (simulation user input, Pulse event). The pressed
 * state is transient sim visuals on the instance — not an option: it is not
 * undoable and not persisted, and is cleared on simulation stop/exit.
 */
export class ButtonComponent extends Component<ButtonOptions> {
  public readonly config = buttonComponentConfig;

  private _pressed = false;

  constructor(options: ButtonOptions) {
    super(buttonMeta, options);
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
    // The square button body replaces the standard chamfered body entirely.
    this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(
        ButtonGraphics,
        scale,
        this.pressed
      )
    );
  }
}
