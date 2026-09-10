import { Component } from '../../component';
import { switchMeta } from '@logigator/core';
import { SwitchGraphics } from '../../../rendering/graphics/switch.graphics';
import { switchComponentConfig, SwitchOptions } from './switch.config';

/**
 * A latching switch (simulation user input, Cont event). The on/off state is
 * transient sim visuals on the instance — not an option: it is not undoable
 * and not persisted, and is cleared on simulation stop/exit.
 */
export class SwitchComponent extends Component<SwitchOptions> {
  public readonly config = switchComponentConfig;

  private _on = false;

  constructor(options: SwitchOptions) {
    super(switchMeta, options);
  }

  public get isOn(): boolean {
    // The base constructor's initial draw runs before field initializers —
    // an unassigned `_on` must read as off.
    return this._on === true;
  }

  public setOn(on: boolean): void {
    if (this.isOn === on) {
      return;
    }
    this._on = on;
    this.redraw();
  }

  public toggle(): void {
    this.setOn(!this.isOn);
  }

  public override clearSimState(): void {
    this.setOn(false);
  }

  protected draw(): void {
    // The square body replaces the chamfered one and stays upright whatever
    // the direction — only the output stub turns — so the on/off bar always
    // reads the same way. Counter-rotating about local (0.5, 0.5) keeps the
    // square in its rotation-invariant footprint at zero net screen rotation.
    const body = this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(SwitchGraphics, scale, this.isOn)
    );
    body.pivot.set(0.5, 0.5);
    body.position.set(0.5, 0.5);
    this.registerRotationCounterContainer(body);
  }
}
