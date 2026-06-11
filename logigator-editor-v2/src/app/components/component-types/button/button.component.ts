import { DestroyOptions, Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { Component } from '../../component';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { ButtonGraphics } from '../../../rendering/graphics/button.graphics';
import { buttonComponentConfig, ButtonOptions } from './button.config';

/**
 * A momentary push button (simulation user input, Pulse event). The pressed
 * state is transient sim visuals on the instance — not an option: it is not
 * undoable and not persisted, and is cleared on simulation stop/exit.
 */
export class ButtonComponent extends Component<ButtonOptions> {
  public readonly config = buttonComponentConfig;

  private readonly destroy$ = new Subject<void>();

  private _pressed = false;

  constructor(options: ButtonOptions) {
    super(0, 1, options.direction.value, options);

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });
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

    const inner = new Graphics(
      this.geometryService.getGraphicsContext(
        ButtonGraphics,
        this.appliedScale,
        this.pressed
      )
    );
    this.addChild(inner);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
