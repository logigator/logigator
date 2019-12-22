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
	'textMode' |
	'newComp' |
	'newProj' |
	'openProj' |
	'save';

export type ShortcutMap =  {
	[A in ShortcutAction]: ShortcutConfig | null
};

export interface ShortcutConfig {
	key_code: string;
	alt?: boolean;
	ctrl?: boolean;
	shift?: boolean;
}
