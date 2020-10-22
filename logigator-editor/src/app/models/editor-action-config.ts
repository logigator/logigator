import {EditorAction} from './editor-action';
import {ShortcutConfig} from './shortcut-config';

export interface EditorActionConfig {
	action: EditorAction;
	shortcut?: ShortcutConfig;

	internal: boolean;

	usableIn: 'editor' | 'simulation' | 'both';

	/**
	 * translation key
	 */
	name?: string;

	/**
	 * used to identify in templates due to: https://github.com/angular/angular/issues/25963
	 */
	stringName: string;
}
