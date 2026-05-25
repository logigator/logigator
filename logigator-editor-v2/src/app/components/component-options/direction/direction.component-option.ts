import { SelectButtonComponentOption } from '../select-button/select-button.component-option';
import { Direction } from '../../../utils/direction';

export class DirectionComponentOption extends SelectButtonComponentOption<Direction> {
	constructor() {
		super(
			'components.options.direction',
			[
				{ value: Direction.E, icon: 'ph ph-arrow-fat-right' },
				{ value: Direction.S, icon: 'ph ph-arrow-fat-down' },
				{ value: Direction.W, icon: 'ph ph-arrow-fat-left' },
				{ value: Direction.N, icon: 'ph ph-arrow-fat-up' }
			],
			Direction.E
		);
	}
}
