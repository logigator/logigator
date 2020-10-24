import {Shortcut} from './shortcut';

export const defaultShortcuts: Shortcut[] = [
	{
		action: 'copy',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'C',
			ctrl: true
		}
	},
	{
		action: 'paste',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'V',
			ctrl: true
		}
	},
	{
		action: 'cut',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'X',
			ctrl: true
		}
	},
	{
		action: 'delete',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'Delete'
		}
	},
	{
		action: 'undo',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'Z',
			ctrl: true
		}
	},
	{
		action: 'redo',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'Y',
			ctrl: true,
		}
	},
	{
		action: 'zoom100',
		usableIn: 'both',
		shortcutConfig: {
			key_code: '0',
			ctrl: true,
		}
	},
	{
		action: 'zoomIn',
		usableIn: 'both'
	},
	{
		action: 'zoomOut',
		usableIn: 'both'
	},
	{
		action: 'fullscreen',
		usableIn: 'both',
		shortcutConfig: {
			key_code: 'F',
			ctrl: true,
			shift: true
		}
	},
	{
		action: 'connWireMode',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'C'
		}
	},
	{
		action: 'wireMode',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'W'
		}
	},
	{
		action: 'selectMode',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'S'
		}
	},
	{
		action: 'eraserMode',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'E'
		}
	},
	{
		action: 'cutSelectMode',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'S',
			shift: true
		}
	},
	{
		action: 'textMode',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'T'
		}
	},
	{
		action: 'newComp',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'N',
			alt: true
		}
	},
	{
		action: 'newProj',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'N',
			alt: true,
			ctrl: true
		}
	},
	{
		action: 'openProj',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'O',
			ctrl: true
		}
	},
	{
		action: 'save',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'S',
			ctrl: true
		}
	},
	{
		action: 'enterSim',
		usableIn: 'editor',
		shortcutConfig: {
			key_code: 'ENTER'
		}
	},
	{
		action: 'leaveSim',
		usableIn: 'simulation',
		shortcutConfig: {
			key_code: 'ESCAPE'
		}
	},
	{
		action: 'startSim',
		usableIn: 'simulation',
	},
	{
		action: 'pauseSim',
		usableIn: 'simulation'
	},
	{
		action: 'stopSim',
		usableIn: 'simulation'
	},
	{
		action: 'singleStepSim',
		usableIn: 'simulation'
	}
];
