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
	'textMode' |
	'newComp' |
	'save';

export type ShortcutMap =  {
	[A in ShortcutAction]: ShortcutConfig | null
};

export interface ShortcutConfig {
	key: string;
	alt?: boolean;
	ctrl?: boolean;
	shift?: boolean;
}
