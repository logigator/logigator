import { DestroyOptions } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { Component } from '../component';
import { ComponentConfig } from '../component-config.model';
import { CustomComponentOptions } from './custom-component.config';
import { CustomComponentDefinition } from './custom-component-definition.model';

/**
 * The single rendering class backing **every** custom component type: a
 * chamfered black box carrying the definition's symbol, with port stubs and
 * labels taken from the definition. The per-definition `ComponentConfig`'s
 * `create` factory injects the matching {@link CustomComponentDefinition}, so
 * no per-definition subclassing is needed.
 *
 * A placed instance always wraps a **frozen snapshot** definition, so it renders
 * from fixed values and does **not** react to master edits — bringing it up to
 * date is an explicit replace (`UpdateInstanceAction`), not live propagation.
 */
export class CustomComponent extends Component<CustomComponentOptions> {
  public readonly config: ComponentConfig<CustomComponentOptions>;

  private readonly destroy$ = new Subject<void>();
  // Set after super(), so it is undefined during the base constructor's initial
  // draw. Every read guards for that.
  private readonly _def: CustomComponentDefinition | undefined;

  constructor(
    options: CustomComponentOptions,
    def: CustomComponentDefinition,
    config: ComponentConfig<CustomComponentOptions>
  ) {
    // Port counts come from the definition, never the element (Invariant A).
    super(def.numInputs, def.numOutputs, options.direction.value, options);
    this._def = def;
    this.config = config;

    this.options.direction.onChange$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.direction = this.options.direction.value;
      });

    // The base constructor's initial draw runs without `_def`, so it omits the
    // symbol and labels. Redraw now that `_def` is set to add them. The snapshot
    // is frozen, so nothing reacts after this.
    this.redraw();
  }

  /** The frozen snapshot definition this instance renders from. */
  public get definition(): CustomComponentDefinition {
    return this._def!;
  }

  protected get inputLabels(): string[] {
    if (!this._def) return [];
    return this._def.labels.slice(0, this._def.numInputs);
  }

  protected get outputLabels(): string[] {
    if (!this._def) return [];
    return this._def.labels.slice(this._def.numInputs);
  }

  // Legacy custom components used a fixed body width of 3; could grow with the
  // symbol width in a later phase.
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  protected get bodyGridWidth(): number {
    return 3;
  }

  // Null during the base constructor's draw — the constructor's redraw()
  // adds the symbol once `_def` is assigned.
  protected override get symbol(): string | null {
    return this._def?.symbol ?? null;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }

  public override destroy(options?: DestroyOptions): void {
    this.destroy$.next();
    super.destroy(options);
  }
}
