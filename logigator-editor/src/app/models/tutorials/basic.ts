import {Tutorial} from '../tutorial';

export const basic: Tutorial = {
	id: 'basic',
	name: 'basic tutorial',
	steps: [
		{
			text: 'tutorial start'
		},
		{
			text: 'construction box',
			elementToHighlight: 'app-construction-box'
		},
		{
			text: 'select',
			elementToHighlight: 'app-toolbar button.toolbar-button.select'
		}
	]
};
