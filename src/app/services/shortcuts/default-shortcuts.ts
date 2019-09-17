import {ShortcutMap} from '../../models/shortcut-map';

export const defaultShortcuts: ShortcutMap = {
	copy: {
		key: 'C',
		ctrl: true
	},
	paste: {
		key: 'V',
		ctrl: true
	},
	cut: {
		key: 'X',
		ctrl: true
	},
	delete: {
		key: 'Delete'
	},
	undo: {
		key: 'Z',
		ctrl: true
	},
	redo: {
		key: 'Y',
		ctrl: true,
	},
	zoom100: {
		key: '0',
		ctrl: true,
	},
	zoomIn: null,
	zoomOut: null,
	connWireMode: {
		key: 'C',
		alt: true
	},
	wireMode: {
		key: 'W',
		alt: true
	},
	selectMode: {
		key: 'S',
		alt: true
	},
	newComp: {
		key: 'N',
		ctrl: true
	},
	textMode: {
		key: 'T',
		alt: true
	},
	save: null,
};
