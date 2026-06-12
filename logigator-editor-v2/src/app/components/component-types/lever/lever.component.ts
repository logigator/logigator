import { DestroyOptions, Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { Component } from '../../component';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { LeverGraphics } from '../../../rendering/graphics/lever.graphics';
import { leverComponentConfig, LeverOptions } from './lever.config';

/**
 * A latching switch (simulation user input, Cont event). The on/off state is
 * transient sim visuals on the instance — not an option: it is not undoable
 * and not persisted, and is cleared on simulation stop/exit.
 */
export class LeverComponent extends Component<LeverOptions> {
  public readonly config = leverComponentConfig;

  private readonly destroy$ = new Subject<void>();

  private _on = false;

  constructor(options: LeverOptions) {
    super(0, 1, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });
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
    const box = new Graphics(
      this.geometryService.getGraphicsContext(
        ComponentGraphics,
        1,
        1,
        this.appliedScale
      )
    );
    this.addChild(box);

    const bar = new Graphics(
      this.geometryService.getGraphicsContext(LeverGraphics, this.isOn)
    );
    this.addChild(bar);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
