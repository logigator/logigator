import {ShortcutMap} from '../../models/shortcut-map';

export const defaultShortcuts: ShortcutMap = {
	copy: {
		key_code: 'C',
		ctrl: true
	},
	paste: {
		key_code: 'V',
		ctrl: true
	},
	cut: {
		key_code: 'X',
		ctrl: true
	},
	delete: {
		key_code: 'Delete'
	},
	undo: {
		key_code: 'Z',
		ctrl: true
	},
	redo: {
		key_code: 'Y',
		ctrl: true,
	},
	zoom100: {
		key_code: '0',
		ctrl: true,
	},
	zoomIn: null,
	zoomOut: null,
	fullscreen: {
		key_code: 'F',
		ctrl: true,
		shift: true
	},
	connWireMode: {
		key_code: 'C',
		alt: true
	},
	wireMode: {
		key_code: 'W',
		alt: true
	},
	selectMode: {
		key_code: 'S',
		alt: true
	},
	newComp: {
		key_code: 'N',
		alt: true
	},
	textMode: {
		key_code: 'T',
		alt: true
	},
	save: {
		key_code: 'S',
		ctrl: true
	},
};
