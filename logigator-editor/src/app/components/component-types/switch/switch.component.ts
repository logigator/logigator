import { Component } from '../../component';
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
    super(0, 1, options);
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
    // The square switch body replaces the standard chamfered body entirely,
    // and stays upright regardless of direction — only the output stub rotates
    // — so the on/off slider bar is always read the same way (legacy-editor
    // behavior). Counter-rotating about the body's centre keeps the square in
    // its (rotation-invariant) footprint: local (0.5, 0.5) maps to the body
    // footprint centre in every direction, so the net screen rotation is zero.
    const body = this.addScaledGraphics((scale) =>
      this.geometryService.getGraphicsContext(SwitchGraphics, scale, this.isOn)
    );
    body.pivot.set(0.5, 0.5);
    body.position.set(0.5, 0.5);
    this.registerRotationCounterContainer(body);
  }
}
