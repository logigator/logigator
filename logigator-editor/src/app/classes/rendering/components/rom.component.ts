import { ElementType } from '../../../models/element/element-type';
import { ElementCategory } from '../../../models/element/element-category';
import { ComponentOption } from '../../component-option/component-option';
import { Component, ComponentConfig } from '../component';
import { ElementRotation } from '../../../models/element-rotation';
import { NumberComponentOption } from '../../component-option/component-options/number.component-option';
import { DirectionComponentOption } from '../../component-option/component-options/direction-component.option';
import { Graphics } from 'pixi.js';
import { ComponentGraphics } from '../graphics/component.graphics';
import { fromGrid } from '../../../utils/grid';

export const romComponentConfig: ComponentConfig = {
	type: ElementType.ROM,
	name: 'ELEMENT_TYPE.ADVANCED.ROM.NAME',
	symbol: 'ROM',
	description: 'Read Only Memory',
	category: ElementCategory.ADVANCED,
	options: [
		new DirectionComponentOption(),
		new NumberComponentOption('Word Size', 1, 64, 4),
		new NumberComponentOption('Address Size', 1, 16, 4)
	],
	generate: (options) => new RomComponent(options)
};

class RomComponent extends Component {
	public readonly config = romComponentConfig;

	constructor(options: ComponentOption<unknown>[]) {
		super(4, 4, options[0].value as ElementRotation, options);
		options[0].onChange = () =>
			(this.direction = options[0].value as ElementRotation);
	}

	protected get inputLabels(): string[] {
		return ['A1', 'A2', 'A3', 'A4'];
	}

	protected get outputLabels(): string[] {
		return ['O1', 'O2', 'O3', 'O4'];
	}

	protected draw(): void {
		const componentGraphics = new Graphics(
			this.geometryService.getGeometry(ComponentGraphics, 3, Math.max(this.numInputs, this.numOutputs))
		);
		componentGraphics.position.set(fromGrid(0.5), 0);
		this.addChild(componentGraphics);
	}
}
