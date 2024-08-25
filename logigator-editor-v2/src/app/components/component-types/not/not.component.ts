import { Component } from '../../component';
import { ComponentOption } from '../../component-option';
import { ComponentRotation } from '../../component-rotation.enum';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { DestroyOptions, Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';
import { notComponentConfig } from './not.config';

export class NotComponent extends Component {
	public readonly config = notComponentConfig;

	private readonly destroy$ = new Subject<void>();

	constructor(options: ComponentOption[]) {
		super(1, 1, options[0].value as ComponentRotation, options);

		options[0].onChange$.pipe(takeUntil(this.destroy$)).subscribe(() => {
			this.direction = options[0].value as ComponentRotation;
		});
	}

	protected get inputLabels(): string[] {
		return [];
	}

	protected get outputLabels(): string[] {
		return [];
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
