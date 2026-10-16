import { Component } from '../../component';
import { switchMeta } from '@logigator/core';
import { SwitchGraphics } from '../../../rendering/graphics/switch.graphics';
import { LevelUserInput } from '../../user-input';
import { switchComponentConfig, SwitchOptions } from './switch.config';

/**
 * A latching switch (simulation user input, a state per flip): a tap flips
 * its output. A {@link LevelUserInput} operated by `toggle`, one slot.
 */
export class SwitchComponent
  extends Component<SwitchOptions>
  implements LevelUserInput
{
  public readonly config = switchComponentConfig;
  public readonly drive = 'level';
  public readonly gesture = 'toggle';
  public readonly inputSlots = 1;

  private _on = false;

  constructor(options: SwitchOptions) {
    super(switchMeta, options);
  }

  public isActive(slot: number): boolean {
    // The base constructor's initial draw runs before field initializers —
    // an unassigned `_on` must read as off.
    return slot === 0 && this._on === true;
  }

  public setActive(slot: number, on: boolean): void {
    if (slot !== 0 || this.isActive(0) === on) {
      return;
    }
    this._on = on;
    this.redraw();
  }

  public override clearSimState(): void {
    this.setActive(0, false);
  }

  protected draw(): void {
    // The square body replaces the chamfered one and stays upright whatever
    // the direction — only the output stub turns — so the on/off bar always
    // reads the same way. Counter-rotating about local (0.5, 0.5) keeps the
    // square in its rotation-invariant footprint at zero net screen rotation.
    const body = this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(
        SwitchGraphics,
        scale,
        this.isActive(0)
      )
    );
    body.pivot.set(0.5, 0.5);
    body.position.set(0.5, 0.5);
    this.registerRotationCounterContainer(body);
  }
}
