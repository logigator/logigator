import { SelectComponentOption } from './select.component-option';
import { ComponentRotation } from '../component-rotation.enum';

export class DirectionComponentOption extends SelectComponentOption<ComponentRotation> {
	constructor() {
		super(
			'components.options.direction',
			[
				{ value: ComponentRotation.Right, icon: 'ph ph-arrow-fat-right' },
				{ value: ComponentRotation.Down, icon: 'ph ph-arrow-fat-down' },
				{ value: ComponentRotation.Left, icon: 'ph ph-arrow-fat-left' },
				{ value: ComponentRotation.Up, icon: 'ph ph-arrow-fat-up' }
			],
			ComponentRotation.Right,
			'button'
		);
	}
}
