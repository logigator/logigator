import { Component } from '../../component';
import { textComponentConfig } from './text.config';
import { ComponentOption } from '../../component-option';
import { Direction } from '../../../utils/direction';
import { ConnectionPointGraphics } from '../../../rendering/graphics/connection-point.graphics';
import { ConnectionPoint } from '../../../connection-points/connection-point';
import { DestroyOptions, Graphics, Text } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { PX } from '../../../utils/grid';
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
			this.redraw();
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
		// ConnectionPointGraphics is a 1×1 unit square; scale to SCREEN_SIZE_PX pixels
		// expressed in grid units, divided by appliedScale to stay constant on screen.
		const sizeGrid = (ConnectionPoint.SCREEN_SIZE_PX * PX) / this.appliedScale;

		const dot = new Graphics();
		dot.context = this.geometryService.getGraphicsContext(
			ConnectionPointGraphics
		);
		dot.pivot.set(0.5, 0.5);
		dot.scale.set(sizeGrid);
		dot.position.set(0.5, 0.5);
		this.addChild(dot);

		// Access options via this.options (set by base constructor before draw() runs).
		const fontSizeOption = this.options[1] as NumberComponentOption;
		const textOption = this.options[2] as TextAreaComponentOption;

		// fontSize is a user-set pixel value; scale.set(PX) converts the label
		// from pixel space to grid space so it can be positioned in grid units.
		const label = new Text({
			text: textOption.value,
			style: {
				fontFamily: 'Roboto',
				fontSize: fontSizeOption.value,
				fill: this.themingService.currentTheme().fontTint
			},
			resolution: this.appliedScale * window.devicePixelRatio
		});
		label.scale.set(PX);
		// For W direction the component is rotated 180°, which would flip the glyphs upside-down.
		// Counter-rotating the label by π keeps glyphs upright; flipping the anchor mirrors
		// the layout so the text still sits on the far side of the dot (left instead of right).
		if (this.direction === Direction.W) {
			label.anchor.set(1, 0.55);
			label.rotation = Math.PI;
		} else {
			label.anchor.set(0, 0.55);
		}
		label.position.set(1, 0.5);
		this.addChild(label);
	}

	public override destroy(options?: DestroyOptions): void {
		this._destroy$.next();
		super.destroy(options);
	}
}
