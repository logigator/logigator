import { Component } from '../../component';
import { ComponentOption } from '../../component-option';
import { Direction } from '../../../utils/direction';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { DestroyOptions, Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { notComponentConfig } from './not.config';

export class NotComponent extends Component {
	public readonly config = notComponentConfig;

	private readonly destroy$ = new Subject<void>();

	constructor(options: ComponentOption[]) {
		super(1, 1, options[0].value as Direction, options);

		options[0].onChange$.pipe(takeUntil(this.destroy$)).subscribe(() => {
			this.direction = options[0].value as Direction;
		});
	}

	protected get inputLabels(): string[] {
		return [];
	}

	protected get outputLabels(): string[] {
		return [];
	}

	// eslint-disable-next-line @typescript-eslint/class-literal-property-style
	protected get bodyGridWidth(): number {
		return 2;
	}

	protected draw(): void {
		const componentGraphics = new Graphics(
			this.geometryService.getGraphicsContext(
				ComponentGraphics,
				2,
				Math.max(this.numInputs, this.numOutputs),
				this.appliedScale
			)
		);
		this._visualSpace.addChild(componentGraphics);
	}

	public override destroy(options?: DestroyOptions): void {
		this.destroy$.next();
		super.destroy(options);
	}
}
