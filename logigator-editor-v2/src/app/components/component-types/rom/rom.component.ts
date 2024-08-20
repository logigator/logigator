import { Component } from '../../component';
import { romComponentConfig } from './rom.config';
import { ComponentOption } from '../../component-option';
import { ComponentRotation } from '../../component-rotation.enum';
import { ComponentGraphics } from '../../../rendering/graphics/component.graphics';
import { Graphics } from 'pixi.js';

export class RomComponent extends Component {
	public readonly config = romComponentConfig;

	constructor(options: ComponentOption<unknown>[]) {
		super(3, 5, options[0].value as ComponentRotation, options);
		options[0].onChange = () =>
			(this.direction = options[0].value as ComponentRotation);
	}

	protected get inputLabels(): string[] {
		return ['A1', 'A2', 'A3', 'A4'];
	}

	protected get outputLabels(): string[] {
		return ['O1', 'O2', 'O3', 'O4'];
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
}
