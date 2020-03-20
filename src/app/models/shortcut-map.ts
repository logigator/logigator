export type ShortcutAction =
	'copy' |
	'paste' |
	'cut' |
	'delete' |
	'undo' |
	'redo' |
	'zoomIn' |
	'zoomOut' |
	'zoom100' |
	'fullscreen' |
	'wireMode' |
	'connWireMode' |
	'selectMode' |
	'cutSelectMode' |
	'eraserMode' |
	'textMode' |
	'newComp' |
	'newProj' |
	'openProj' |
	'save' |
	'enterSim' |
	'leaveSim';

export type ShortcutMap =  {
	[A in ShortcutAction]: ShortcutConfig | null
};

export interface ShortcutConfig {
	key_code: string;
	alt?: boolean;
	ctrl?: boolean;
	shift?: boolean;
}
