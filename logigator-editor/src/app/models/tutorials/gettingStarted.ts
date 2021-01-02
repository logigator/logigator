import {ExplanationBoxLoc, Tutorial} from '../tutorial';

export const gettingStarted: Tutorial = {
	id: 'gettingStarted',
	name: 'TUTORIAL.GETTING_STARTED.NAME',
	steps: [
		{
			title: 'TUTORIAL.GETTING_STARTED.WELCOME.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.WELCOME.TEXT'
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.ZOOM_PAN.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.ZOOM_PAN.TEXT'
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.PLACING_ELEMS.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.PLACING_ELEMS.TEXT',
			elementToExplain: '#construction-box',
			explanationBoxLocation: ExplanationBoxLoc.Right
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.WIRES.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.WIRES.TEXT',
			elementToExplain: 'app-toolbar .toolbar-button.wire',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.CONN_WIRE.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.CONN_WIRE.TEXT',
			elementToExplain: 'app-toolbar .toolbar-button.conn-wire',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.SELECT.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.SELECT.TEXT',
			elementToExplain: 'app-toolbar .toolbar-button.select',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.SELECT_CUT.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.SELECT_CUT.TEXT',
			elementToExplain: 'app-toolbar .toolbar-button.select-cut',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.ERASER.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.ERASER.TEXT',
			elementToExplain: 'app-toolbar .toolbar-button.eraser',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.TEXT.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.TEXT.TEXT',
			elementToExplain: 'app-toolbar .toolbar-button.text',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.CUSTOM_COMPONENTS.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.CUSTOM_COMPONENTS.TEXT',
			elementToExplain: 'app-toolbar .toolbar-button.new-comp',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		},
		{
			title: 'TUTORIAL.GETTING_STARTED.SIMULATION_MODE.TITLE',
			text: 'TUTORIAL.GETTING_STARTED.SIMULATION_MODE.TEXT',
			elementToExplain: 'app-toolbar div.toolbar-end > div',
			explanationBoxLocation: ExplanationBoxLoc.Bottom
		}
	]
};
