import { ElementType } from '../../../models/element/element-type';
import { ElementCategory } from '../../../models/element/element-category';
import { ComponentOption } from '../../component-option/component-option';
import { Component, ComponentConfig } from '../component';
import { ElementRotation } from '../../../models/element-rotation';
import { NumberComponentOption } from '../../component-option/component-options/number.component-option';
import { RotationComponentOption } from '../../component-option/component-options/rotation.component-option';
import { ThemingService } from '../../../services/theming/theming.service';
import { getStaticDI } from '../../../utils/get-di';
import { Graphics, Point } from 'pixi.js';

export const romComponentConfig: ComponentConfig = {
	name: 'ROM',
	type: ElementType.ROM,
	description: 'Read Only Memory',
	category: ElementCategory.ADVANCED,
	options: [
		new RotationComponentOption(),
		new NumberComponentOption(
			'Word Size',
			1,
			64,
			4
		),
		new NumberComponentOption(
			'Address Size',
			1,
			16,
			4
		)
	],
	generate: (options) => new RomComponent(options)
}

export class RomComponent extends Component {

	public readonly config = romComponentConfig;

	private themingService: ThemingService;

	constructor(options: ComponentOption<unknown>[]) {
		super(4, 4, options[0].value as ElementRotation, options);
		this.themingService = getStaticDI(ThemingService);
	}

	protected override get labels(): string[] {
		return [];
	}

	protected override draw(): void {
		super.draw();

		this.themingService = getStaticDI(ThemingService);

		const graphics = new Graphics();

		graphics.lineStyle(1, this.themingService.getEditorColor('wire'), 1, 0.5, true);
		graphics.beginFill(this.themingService.getEditorColor('background'));

		const size = this.fromGrid(new Point(this.gridWidth, this.gridHeight));

		graphics.moveTo(0, 0);
		graphics.lineTo(size.x - 3, 0);
		graphics.lineTo(size.x, 3);
		graphics.lineTo(size.x, size.y - 3);
		graphics.lineTo(size.x - 3, size.y);
		graphics.lineTo(0, size.y);
		graphics.lineTo(0, 0);
		graphics.position = this.fromGrid(new Point(0.5, 0));
		this.addChild(graphics);
	}
}
