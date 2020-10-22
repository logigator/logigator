import {Injectable} from '@angular/core';
import {ShortcutConfig} from '../../models/shortcut-config';
import {defaultShortcuts} from '../../models/default-shortcuts';
import {ShortcutAction} from '../../models/shortcut-action';
import {Shortcut} from '../../models/shortcut';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../work-mode/work-mode.service';

@Injectable({
	providedIn: 'root'
})
export class ShortcutsService {

	private _shortcutConfig = defaultShortcuts;

	private _shortcutListenerEnabled = true;

	constructor(private workMode: WorkModeService) {}

	public keyDownListener(event: KeyboardEvent) {
		if (!this._shortcutListenerEnabled) return;
		const shortcut = this.getShortcutFromKeyEvent(event);
		if (!shortcut || !this.isShortcutUsable(shortcut)) return;
		event.preventDefault();
		event.stopPropagation();
		this.applyShortcutAction(shortcut.action);
	}

	public getShortcutConfigFromKeyEvent(event: KeyboardEvent): ShortcutConfig {
		return {
			key_code: event.key.toUpperCase(),
			shift: event.shiftKey,
			ctrl: event.ctrlKey,
			alt: event.altKey
		};
	}

	public getShortcutText(config: ShortcutConfig) {
		let result = '';
		if (config.ctrl) {
			result += 'Ctrl+';
		}
		if (config.alt) {
			result += 'Alt+';
		}
		if (config.shift) {
			result += 'Shift+';
		}

		let key = config.key_code.toUpperCase();
		if (key === ' ') key = 'SPACE';

		return result + key;
	}

	public getShortcutTextForAction(action: ShortcutAction) {
		const config = this._shortcutConfig.find(a => a.action === action);

		if (!config?.shortcutConfig) return '';
		return this.getShortcutText(config.shortcutConfig);
	}

	private getShortcutFromKeyEvent(event: KeyboardEvent): Shortcut {
		for (const shortcut of this._shortcutConfig) {
			if (shortcut.shortcutConfig && event.key.toUpperCase() === shortcut.shortcutConfig.key_code.toUpperCase() &&
				event.shiftKey === !!shortcut.shortcutConfig.shift &&
				event.ctrlKey === !!shortcut.shortcutConfig.ctrl &&
				event.altKey === !!shortcut.shortcutConfig.alt
			) {
				return shortcut;
			}
		}
		return undefined;
	}

	private isShortcutUsable(shortcut: Shortcut): boolean {
		if (shortcut.usableIn === 'simulation')
			return this.workMode.currentWorkMode === WorkMode.SIMULATION;
		if (shortcut.usableIn === 'editor')
			return this.workMode.currentWorkMode !== WorkMode.SIMULATION;
		return true;
	}

	public setShortcutConfig(config: any) {
	}

	public get shortcutActionConfig(): Shortcut[] {
		return this._shortcutConfig;
	}

	public enableShortcutListener() {
		this._shortcutListenerEnabled = true;
	}

	public disableShortcutListener() {
		this._shortcutListenerEnabled = false;
	}

	private applyShortcutAction(action: ShortcutAction) {
	}

}
