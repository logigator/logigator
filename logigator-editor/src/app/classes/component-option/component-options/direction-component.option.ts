import { SelectComponentOption } from './select.component-option';
import { ElementRotation } from '../../../models/element-rotation';

export class DirectionComponentOption extends SelectComponentOption<ElementRotation> {
	constructor() {
		super(
			'SETTINGS_INFO.DIRECTION',
			[
				{value: ElementRotation.Right, label: 'SETTINGS_INFO.RIGHT'},
				{value: ElementRotation.Down, label: 'SETTINGS_INFO.DOWN'},
				{value: ElementRotation.Left, label: 'SETTINGS_INFO.LEFT'},
				{value: ElementRotation.Up, label: 'SETTINGS_INFO.UP'}
			],
			ElementRotation.Right
		);
	}
}
