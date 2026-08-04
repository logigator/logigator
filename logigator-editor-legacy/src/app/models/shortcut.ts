import { ShortcutAction } from './shortcut-action';
import { ShortcutConfig } from './shortcut-config';

export interface Shortcut {
	action: ShortcutAction;
	usableIn: 'editor' | 'simulation' | 'both';
	shortcutConfig?: ShortcutConfig;
}
