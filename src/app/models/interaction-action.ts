import {ShortcutAction} from './shortcut-map';

export type InteractionAction = ShortcutAction | 'share' | 'export' | 'editDropdown' | 'exportImage';

export type InteractionActionUsableInSimulation = {
	[A in InteractionAction]: boolean;
};
