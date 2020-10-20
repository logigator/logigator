import {Injectable} from '@angular/core';
import {editorActionDefaultConfig} from '../../models/editor-action-default-config';
import {ShortcutConfig} from '../../models/shortcut-config';
import {EditorAction} from '../../models/editor-action';
import {EditorActionConfig} from '../../models/editor-action-config';
import {Observable, Subject} from 'rxjs';
import {EditorActionEvent} from '../../models/editor-action-event';
import {filter} from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EditorActionsService {

	private _actionConfig = editorActionDefaultConfig;

	private _editorActionsSubject = new Subject<EditorActionEvent>();

	private _shortcutListenerEnabled = true;

	constructor() {}

	public triggerAction(action: EditorAction, data?: any) {
		this._editorActionsSubject.next({
			action,
			data
		});
	}

	public subscribe(action?: EditorAction): Observable<EditorActionEvent> {
		if (!action) {
			return this._editorActionsSubject.asObservable();
		}
		return this._editorActionsSubject.pipe(
			filter(event => event.action === action)
		);
	}

	public keyDownListener(event: KeyboardEvent) {
		if (!this._shortcutListenerEnabled) return;
		const action = this.getEditorActionFromKeyEvent(event);
		if (!action) return;
		event.preventDefault();
		event.stopPropagation();
		this.triggerAction(action);
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

	public getShortcutTextForAction(action: EditorAction) {
		const config = this._actionConfig.find(a => a.action === action);

		if (!config) return '';
		return this.getShortcutText(config.shortcut);
	}

	public getShortcutTextForActionByStringName(name: string) {
		const config = this._actionConfig.find(a => a.stringName === name);

		if (!config) return '';
		return this.getShortcutText(config.shortcut);
	}

	private getEditorActionFromKeyEvent(event: KeyboardEvent): EditorAction | undefined {
		for (const actionConfig of this._actionConfig) {
			if (actionConfig.shortcut && event.key.toUpperCase() === actionConfig.shortcut.key_code.toUpperCase() &&
				event.shiftKey === !!actionConfig.shortcut.shift &&
				event.ctrlKey === !!actionConfig.shortcut.ctrl &&
				event.altKey === !!actionConfig.shortcut.alt
			) {
				return actionConfig.action;
			}
		}
		return undefined;
	}

	public setShortcutConfig(config: any) {
	}

	public get actionConfig(): EditorActionConfig[] {
		return this._actionConfig;
	}

}
