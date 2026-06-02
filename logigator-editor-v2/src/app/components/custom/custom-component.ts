import { DestroyOptions, Graphics, Text } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { Component } from '../component';
import { ComponentConfig } from '../component-config.model';
import { ComponentGraphics } from '../../rendering/graphics/component.graphics';
import { PX } from '../../utils/grid';
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

	protected draw(): void {
		const box = new Graphics(
			this.geometryService.getGraphicsContext(
				ComponentGraphics,
				this.bodyGridWidth,
				this.bodyGridHeight,
				this.appliedScale
			)
		);
		this.addChild(box);

		// Runs once from the base constructor before `_def` exists — the box above
		// is enough then; the symbol is added by the constructor's redraw().
		const def = this._def;
		if (!def) return;

		const symbol = new Text({
			text: def.symbol,
			style: {
				fontFamily: 'Roboto',
				fontSize: 0.5 / PX,
				fill: this.themingService.currentTheme().fontTint
			},
			anchor: { x: 0.5, y: 0.5 },
			resolution: this.appliedScale * window.devicePixelRatio
		});
		symbol.scale.set(PX);
		symbol.position.set(this.bodyGridWidth / 2, this.bodyGridHeight / 2);
		// Keep the symbol upright regardless of the component's rotation.
		this.registerRotationCounterContainer(symbol);
		this.addChild(symbol);
	}

	public override destroy(options?: DestroyOptions): void {
		this.destroy$.next();
		super.destroy(options);
	}
}
