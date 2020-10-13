import {ShortcutAction} from './shortcut-map';

export type InteractionAction = ShortcutAction | 'share' | 'export' | 'editDropdown' | 'exportImage';

export type InteractionActionUsable = {
	[A in InteractionAction]: boolean;
};
