import { Component } from '../../component';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { DestroyOptions, Graphics, Text } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { PX } from '../../../utils/grid';
import { outputComponentConfig, OutputOptions } from './output.config';

export class OutputComponent extends Component<OutputOptions> {
	public readonly config = outputComponentConfig;

	private readonly destroy$ = new Subject<void>();

	constructor(options: OutputOptions) {
		// A plug's port counts are fixed: an OUTPUT exposes exactly one input
		// (the signal it draws out of the circuit). The `i`/`o` wire fields are
		// ignored on load — counts come from here, not from the element.
		super(1, 0, options.direction.value, options);

		this.options.direction.onChange$
			.pipe(takeUntil(this.destroy$))
			.subscribe(() => {
				this.direction = this.options.direction.value;
			});
	}

	// A 1×1 plug is symbol-only: the centered "OUT" glyph fills the body, so the
	// per-stub label path (which draws labels *inside* the body) would overlap
	// it. The port name is surfaced via click-to-name and the Ports panel
	// instead. Label-beside-stub rendering is left to a later phase.
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

		const symbol = new Text({
			// Use the module-level config, not `this.config`: `draw()` runs from
			// the base constructor before the subclass `config` field is assigned.
			text: outputComponentConfig.symbol,
			style: {
				fontFamily: 'Roboto',
				fontSize: 0.35 / PX,
				fill: this.themingService.currentTheme().fontTint
			},
			anchor: { x: 0.5, y: 0.5 },
			resolution: this.appliedScale * window.devicePixelRatio
		});
		symbol.scale.set(PX);
		symbol.position.set(0.5, 0.5);
		this.registerRotationCounterContainer(symbol);
		this.addChild(symbol);
	}

	public override destroy(options?: DestroyOptions): void {
		this.destroy$.next();
		super.destroy(options);
	}
}
