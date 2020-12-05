import {ExplanationBoxLoc, Tutorial} from '../tutorial';

export const basic: Tutorial = {
	id: 'basic',
	name: 'basic tutorial',
	steps: [
		{
			title: 'tutorial start',
			text: 'construction box',
			elementToExplain: 'app-construction-box',
			explanationBoxLocation: ExplanationBoxLoc.Right
		},
		{
			title: 'tutorial start',
			text: 'select',
			elementToExplain: 'app-toolbar button.toolbar-button.select',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		},
		{
			title: 'tutorial start',
			text: 'select',
			elementToExplain: 'app-toolbar div.toolbar-end > p',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		}
	]
};
