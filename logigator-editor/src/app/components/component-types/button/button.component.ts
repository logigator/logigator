import { Component } from '../../component';
import { buttonMeta } from '@logigator/core';
import { ButtonGraphics } from '../../../rendering/graphics/button.graphics';
import { buttonComponentConfig, ButtonOptions } from './button.config';

/**
 * A button (simulation user input, Cont event): its output is high for as long
 * as it is held. The held state is transient sim visuals on the instance — not
 * an option: it is not undoable and not persisted, and is cleared on
 * simulation stop/exit.
 */
export class ButtonComponent extends Component<ButtonOptions> {
  public readonly config = buttonComponentConfig;

  private _held = false;

  constructor(options: ButtonOptions) {
    super(buttonMeta, options);
  }

  public get held(): boolean {
    // The base constructor's initial draw runs before field initializers —
    // an unassigned `_held` must read as released.
    return this._held === true;
  }

  public setHeld(held: boolean): void {
    if (this.held === held) {
      return;
    }
    this._held = held;
    this.redraw();
  }

  public override clearSimState(): void {
    this.setHeld(false);
  }

  protected draw(): void {
    // The square button body replaces the standard chamfered body entirely.
    this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(ButtonGraphics, scale, this.held)
    );
  }
}
