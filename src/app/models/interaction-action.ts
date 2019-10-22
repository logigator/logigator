import {ShortcutAction} from './shortcut-map';

export type InteractionAction = ShortcutAction | 'share' | 'export' | 'editDropdown';

export type InteractionActionUsableInSimulation = {
	[A in InteractionAction]: boolean;
};
