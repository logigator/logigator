import { Component } from '../../component';
import { romComponentConfig } from './rom.config';
import { ComponentOption } from '../../component-option';
import { ComponentRotation } from '../../component-rotation.enum';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { Graphics } from 'pixi.js';
import { Subject, takeUntil } from 'rxjs';

export class RomComponent extends Component {
	public readonly config = romComponentConfig;

	private readonly destroy$ = new Subject<void>();

	constructor(options: ComponentOption[]) {
		super(
			options[1].value as number,
			options[2].value as number,
			options[0].value as ComponentRotation,
			options
		);

		options[0].onChange$.pipe(takeUntil(this.destroy$)).subscribe(() => {
			this.direction = options[0].value as ComponentRotation;
		});
	}

	protected get inputLabels(): string[] {
		const labels = [];
		for (let i = 1; i <= this.numInputs; i++) {
			labels.push(`A${i}`);
		}
		return labels;
	}

	protected get outputLabels(): string[] {
		const labels = [];
		for (let i = 1; i <= this.numOutputs; i++) {
			labels.push(`O${i}`);
		}
		return labels;
	}

	protected draw(): void {
		const componentGraphics = new Graphics(
			this.geometryService.getGraphicsContext(
				ComponentGraphics,
				3,
				Math.max(this.numInputs, this.numOutputs),
				this.appliedScale
			)
		);
		this.addChild(componentGraphics);
	}

	public override destroy(): void {
		this.destroy$.next();
		super.destroy();
	}
}
