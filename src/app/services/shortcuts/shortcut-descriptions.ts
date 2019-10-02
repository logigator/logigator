import {ShortcutDescriptionMap, ShortcutUsableInSimulationMap} from '../../models/shortcut-map';

export const shortcutDescriptions: ShortcutDescriptionMap = {
	copy: 'Copy',
	paste: 'Paste',
	cut: 'Cut',
	delete: 'Delete selected items',
	undo: 'Undo',
	redo: 'Redo',
	zoom100: 'Zoom to 100%',
	zoomIn: 'Zoom in',
	zoomOut: 'Zoom out',
	fullscreen: 'enter fullscreen mode',
	connWireMode: 'Connect wires mode',
	wireMode: 'Place wires mode',
	selectMode: 'selection mode',
	newComp: 'Create new custom component',
	textMode: 'text mode',
	save: 'Save',
};

export const shortcutsUsableInSimulation: ShortcutUsableInSimulationMap = {
	copy: false,
	paste: false,
	cut: false,
	delete: false,
	undo: false,
	redo: false,
	zoom100: true,
	zoomIn: true,
	zoomOut: true,
	fullscreen: true,
	connWireMode: false,
	wireMode: false,
	selectMode: false,
	newComp: false,
	textMode: false,
	save: false,
};
