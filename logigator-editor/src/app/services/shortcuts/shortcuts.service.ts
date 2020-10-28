import {Injectable} from '@angular/core';
import {ShortcutConfig} from '../../models/shortcut-config';
import {defaultShortcuts} from '../../models/default-shortcuts';
import {ShortcutAction} from '../../models/shortcut-action';
import {Shortcut} from '../../models/shortcut';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../work-mode/work-mode.service';
import {UserService} from '../user/user.service';
import {ApiService} from '../api/api.service';
import {UserShortcut} from '../../models/http/response/user';
import {EditorInteractionService} from '../editor-interaction/editor-interaction.service';
import {SimulationManagementService} from '../simulation/simulation-management/simulation-management.service';
import {PopupService} from '../popup/popup.service';

@Injectable({
	providedIn: 'root'
})
export class ShortcutsService {

	private _shortcutConfig = defaultShortcuts;
	private _customShortcuts = new Map<ShortcutAction, ShortcutConfig>();

	private _shortcutListenerEnabled = true;

	constructor(
		private workMode: WorkModeService,
		private editorInteraction: EditorInteractionService,
		private simulationManagement: SimulationManagementService,
		private userService: UserService,
		private apiService: ApiService,
		private popupService: PopupService
	) {
		this.userService.userInfo$.subscribe(data => {
			if (!data)
				return;
			for (const shortcut of data.shortcuts) {
				const index = this._shortcutConfig.findIndex(x => x.action === shortcut.name);
				if (index >= 0) {
					this._shortcutConfig[index].shortcutConfig.key_code = shortcut.keyCode;
					this._shortcutConfig[index].shortcutConfig.shift = shortcut.shift;
					this._shortcutConfig[index].shortcutConfig.ctrl = shortcut.ctrl;
					this._shortcutConfig[index].shortcutConfig.alt = shortcut.alt;
					this._customShortcuts.set(shortcut.name as ShortcutAction, this._shortcutConfig[index].shortcutConfig);
				}
			}
		});
	}

	public keyDownListener(event: KeyboardEvent) {
		if (!this.shortcutListenerEnabled) return;
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

	public async setShortcutConfig(config: Map<ShortcutAction, ShortcutConfig>) {
		for (const [key, val] of config) {
			const index = this._shortcutConfig.findIndex(x => x.action === key);
			if (index >= 0) {
				this._shortcutConfig[index].shortcutConfig = val;
				this._customShortcuts.set(key, val);
			}
		}

		const patchData = [];
		for (const [key, val] of this._customShortcuts) {
			patchData.push({
				name: key,
				keyCode: val.key_code,
				shift: val.shift,
				ctrl: val.ctrl,
				alt: val.alt
			} as UserShortcut);
		}
		await this.apiService.patch<any>('/user', {
			shortcuts: patchData
		}).toPromise();
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

	private get shortcutListenerEnabled(): boolean {
		return this._shortcutListenerEnabled && !this.popupService.isPopupOpened;
	}

	private applyShortcutAction(action: ShortcutAction) {
		switch (action) {
			case 'copy':
				this.editorInteraction.copy();
				break;
			case 'paste':
				this.editorInteraction.paste();
				break;
			case 'cut':
				this.editorInteraction.cut();
				break;
			case 'delete':
				this.editorInteraction.delete();
				break;
			case 'undo':
				this.editorInteraction.undo();
				break;
			case 'redo':
				this.editorInteraction.redo();
				break;
			case 'zoomIn':
				this.editorInteraction.zoomIn();
				break;
			case 'zoomOut':
				this.editorInteraction.zoomOut();
				break;
			case 'zoom100':
				this.editorInteraction.zoom100();
				break;
			case 'fullscreen':
				this.editorInteraction.fullscreen();
				break;
			case 'wireMode':
				this.workMode.setWorkMode(WorkMode.WIRE);
				break;
			case 'connWireMode':
				this.workMode.setWorkMode(WorkMode.CONN_WIRE);
				break;
			case 'selectMode':
				this.workMode.setWorkMode(WorkMode.SELECT);
				break;
			case 'cutSelectMode':
				this.workMode.setWorkMode(WorkMode.CUT_SELECT);
				break;
			case 'eraserMode':
				this.workMode.setWorkMode(WorkMode.ERASER);
				break;
			case 'textMode':
				this.workMode.setWorkMode(WorkMode.TEXT);
				break;
			case 'newComp':
				break;
			case 'newProj':
				break;
			case 'openProj':
				break;
			case 'save':
				break;
			case 'enterSim':
				this.workMode.enterSimulation();
				break;
			case 'leaveSim':
				this.workMode.leaveSimulation();
				break;
			case 'startSim':
				this.simulationManagement.continueSim();
				break;
			case 'pauseSim':
				this.simulationManagement.pauseSim();
				break;
			case 'stopSim':
				this.simulationManagement.stopSim();
				break;
			case 'singleStepSim':
				this.simulationManagement.singleStepSim();
				break;
		}
	}

}
