import { SelectComponentOption } from './select.component-option';
import { ComponentRotation } from '../component-rotation.enum';

export class DirectionComponentOption extends SelectComponentOption<ComponentRotation> {
	constructor() {
		super(
			'SETTINGS_INFO.DIRECTION',
			[
				{ value: ComponentRotation.Right, label: 'SETTINGS_INFO.RIGHT' },
				{ value: ComponentRotation.Down, label: 'SETTINGS_INFO.DOWN' },
				{ value: ComponentRotation.Left, label: 'SETTINGS_INFO.LEFT' },
				{ value: ComponentRotation.Up, label: 'SETTINGS_INFO.UP' }
			],
			ComponentRotation.Right
		);
	}
}
