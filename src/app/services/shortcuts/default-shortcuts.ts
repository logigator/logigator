import {ShortcutMap} from '../../models/shortcut-map';

export const defaultShortcuts: ShortcutMap = {
	copy: {
		keyCode: 'KeyC',
		ctrl: true
	},
	paste: {
		keyCode: 'KeyV',
		ctrl: true
	},
	cut: {
		keyCode: 'KeyX',
		ctrl: true
	},
	delete: {
		keyCode: 'Delete'
	},
	undo: {
		keyCode: 'KeyZ',
		ctrl: true
	},
	redo: {
		keyCode: 'KeyY',
		ctrl: true,
	},
	zoom100: {
		keyCode: 'Digit0',
		ctrl: true,
	},
	zoomIn: null,
	zoomOut: null,
	connWireMode: {
		keyCode: 'KeyC',
		alt: true
	},
	wireMode: {
		keyCode: 'KeyW',
		alt: true
	},
	selectMode: {
		keyCode: 'KeyS',
		alt: true
	},
	newComp: {
		keyCode: 'KeyN',
		ctrl: true
	},
	textMode: {
		keyCode: 'KeyT',
		alt: true
	},
	save: null,
};
