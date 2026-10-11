import { Component } from '../../component';
import { buttonMeta } from '@logigator/core';
import { ButtonGraphics } from '../../../rendering/graphics/button.graphics';
import { LevelUserInput } from '../../user-input';
import { buttonComponentConfig, ButtonOptions } from './button.config';

/**
 * A button (simulation user input, Cont event): its output is high for as long
 * as it is held. A {@link LevelUserInput} operated by `hold`, one slot.
 */
export class ButtonComponent
  extends Component<ButtonOptions>
  implements LevelUserInput
{
  public readonly config = buttonComponentConfig;
  public readonly drive = 'level';
  public readonly gesture = 'hold';
  public readonly inputSlots = 1;

  private _held = false;

  constructor(options: ButtonOptions) {
    super(buttonMeta, options);
  }

  public isActive(slot: number): boolean {
    // The base constructor's initial draw runs before field initializers —
    // an unassigned `_held` must read as released.
    return slot === 0 && this._held === true;
  }

  public setActive(slot: number, held: boolean): void {
    if (slot !== 0 || this.isActive(0) === held) {
      return;
    }
    this._held = held;
    this.redraw();
  }

  public override clearSimState(): void {
    this.setActive(0, false);
  }

  protected draw(): void {
    // The square button body replaces the standard chamfered body entirely.
    this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(
        ButtonGraphics,
        scale,
        this.isActive(0)
      )
    );
  }
}
