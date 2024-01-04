import { ElementType } from '../../../models/element/element-type';
import { ElementCategory } from '../../../models/element/element-category';
import { NumberComponentOption } from '../component-option';
import { Component } from '../component';
import { ElementRotation } from '../../../models/element-rotation';
import { Point } from 'pixi.js';

export class RomComponent extends Component {
	public readonly type = ElementType.ROM;
	public readonly category = ElementCategory.ADVANCED;

	public readonly options = [
		new NumberComponentOption(
			'Word Size',
			1,
			64,
			this.numInputs,
			(value) => (this.numInputs = value)
		),
		new NumberComponentOption(
			'Address Size',
			1,
			16,
			this.numOutputs,
			(value) => (this.numOutputs = value)
		)
	];

	constructor() {
		super(4, 4, ElementRotation.Left, new Point(0, 0), new Point(5, 5));
	}

	protected override get labels(): string[] {
		return [];
	}
}
