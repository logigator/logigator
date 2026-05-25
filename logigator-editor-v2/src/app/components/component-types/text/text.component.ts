import { Component } from '../../component';
import { textComponentConfig } from './text.config';
import { ComponentOption } from '../../component-option';
import { Direction } from '../../../utils/direction';
import { ConnectionPointGraphics } from '../../../rendering/graphics/connection-point.graphics';
import { ConnectionPoint } from '../../../connection-points/connection-point';
import { DestroyOptions, Graphics, Text } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { fromGrid } from '../../../utils/grid';
import { TextAreaComponentOption } from '../../component-options/text-area/text-area.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';

export class TextComponent extends Component {
	public readonly config = textComponentConfig;
	public override readonly ignoresWireCollision = true;

	private readonly _destroy$ = new Subject<void>();

	constructor(options: ComponentOption[]) {
		super(0, 0, options[0].value as Direction, options);

		options[0].onChange$.pipe(takeUntil(this._destroy$)).subscribe(() => {
			this.direction = options[0].value as Direction;
		});
		(options[1] as TextAreaComponentOption).onChange$
			.pipe(takeUntil(this._destroy$))
			.subscribe(() => this.redraw());
		(options[2] as NumberComponentOption).onChange$
			.pipe(takeUntil(this._destroy$))
			.subscribe(() => this.redraw());
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

	protected override get bodyGridHeight(): number {
		return 1;
	}

	protected draw(): void {
		// Items in _visualSpace (scale=1/gridSize) have effective screen scale = appliedScale.
		// To keep the dot SCREEN_SIZE_PX pixels wide at any zoom level we scale by sizePx = SCREEN_SIZE_PX/appliedScale.
		const sizePx = ConnectionPoint.SCREEN_SIZE_PX / this.appliedScale;

		const dot = new Graphics();
		dot.context = this.geometryService.getGraphicsContext(
			ConnectionPointGraphics
		);
		dot.pivot.set(0.5, 0.5);
		dot.scale.set(sizePx);
		dot.position.set(fromGrid(0.5), fromGrid(0.5));
		this._visualSpace.addChild(dot);

		// Access options via this.options (set by base constructor before draw() runs).
		const textOption = this.options[1] as TextAreaComponentOption;
		const fontSizeOption = this.options[2] as NumberComponentOption;

		const label = new Text({
			text: textOption.value,
			style: {
				fontFamily: 'Roboto',
				fontSize: fontSizeOption.value,
				fill: this.themingService.currentTheme().fontTint
			},
			anchor: { x: 0, y: 0.5 },
			resolution: this.appliedScale * window.devicePixelRatio
		});
		label.position.set(fromGrid(0.5) + sizePx / 2 + 2, fromGrid(0.5));
		this.registerConstantRotationContainer(label);
		this._visualSpace.addChild(label);
	}

	public override destroy(options?: DestroyOptions): void {
		this._destroy$.next();
		super.destroy(options);
	}
}
