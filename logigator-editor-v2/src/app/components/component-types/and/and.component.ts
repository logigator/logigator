import { Component } from '../../component';
import { ComponentOption } from '../../component-option';
import { Direction } from '../../../utils/direction';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { DestroyOptions, Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { andComponentConfig } from './and.config';

export class AndComponent extends Component {
	public readonly config = andComponentConfig;

	private readonly destroy$ = new Subject<void>();

	constructor(options: ComponentOption[]) {
		super(
			options[1].value as number,
			1,
			options[0].value as Direction,
			options
		);

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
		this.addChild(componentGraphics);
	}

	public override destroy(options?: DestroyOptions): void {
		this.destroy$.next();
		super.destroy(options);
	}
}
