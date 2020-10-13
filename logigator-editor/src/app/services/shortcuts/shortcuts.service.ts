import {Injectable} from '@angular/core';
import {defaultShortcuts} from './default-shortcuts';
import {ShortcutAction, ShortcutConfig, ShortcutMap} from '../../models/shortcut-map';
import {WorkModeService} from '../work-mode/work-mode.service';
import {ProjectInteractionService} from '../project-interaction/project-interaction.service';
import {ThemingService} from '../theming/theming.service';
import {HttpClient} from '@angular/common/http';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {UserService} from '../user/user.service';
import {environment} from '../../../environments/environment';
import {PopupService} from '@logigator/logigator-shared-comps';
import {RenderTicker} from '../render-ticker/render-ticker.service';
import {checkActionUsable} from '../../models/action-usable-in-modes';

@Injectable({
	providedIn: 'root'
})
export class ShortcutsService {

	private _shortcutMap: ShortcutMap = defaultShortcuts;

	private _shortcutListenerEnabled = true;

	constructor(
		private workMode: WorkModeService,
		private projectInteraction: ProjectInteractionService,
		private theming: ThemingService,
		private popup: PopupService,
		private http: HttpClient,
		private errorHandling: ErrorHandlingService,
		private user: UserService,
		private renderTicker: RenderTicker
	) {
		this.loadShortcutSettings();
	}

	private async loadShortcutSettings() {
		const userInfo = await this.user.userInfo$.toPromise();
		if (!userInfo) return;
		const customConfig: {[key: string]: ShortcutConfig} = {};
		userInfo.shortcuts.forEach(s => {
			customConfig[s.name] = {
				alt: s.alt,
				ctrl: s.ctrl,
				shift: s.shift,
				key_code: s.key_code
			};
		});
		this._shortcutMap = {
			...this.shortcutMap,
			...customConfig
		};
	}

	public setShortcutConfig(newConfig: {[key: string]: ShortcutConfig}) {
		this._shortcutMap = {
			...this.shortcutMap,
			...newConfig
		};
		if (!this.user.isLoggedIn) return;
		this.http.post(environment.apiPrefix + '/user/update', {
			shortcuts: newConfig
		}).pipe(
			this.errorHandling.catchErrorOperator('ERROR.USER.SAVE_SHORTCUTS', undefined)
		).subscribe();
	}

	public keyDownListener(e: KeyboardEvent) {
		if (this.popup.isPopupOpened || !this._shortcutListenerEnabled) return;
		const action = this.getShortcutActionFromEvent(e);
		if (!action) return;
		e.preventDefault();
		e.stopPropagation();
		this.applyAction(action);
	}

	public getShortcutTextForAction(action: ShortcutAction) {
		const config = this._shortcutMap[action];

		if (!config) return '';
		return this.getShortcutText(config);
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

	public get shortcutMap(): ShortcutMap {
		return this._shortcutMap;
	}

	public getShortcutConfigFromEvent(event: KeyboardEvent): ShortcutConfig {
		return {
			key_code: event.key.toUpperCase(),
			shift: event.shiftKey,
			ctrl: event.ctrlKey,
			alt: event.altKey
		};
	}

	set shortcutListenerEnabled(value: boolean) {
		this._shortcutListenerEnabled = value;
	}

	private getShortcutActionFromEvent(e: KeyboardEvent): ShortcutAction | null {
		for (const action in this._shortcutMap) {
			const shortcutConfig = this._shortcutMap[action];
			if (shortcutConfig &&
				e.key.toUpperCase() === shortcutConfig.key_code.toUpperCase() &&
				e.shiftKey === !!shortcutConfig.shift &&
				e.ctrlKey === !!shortcutConfig.ctrl &&
				e.altKey === !!shortcutConfig.alt
			) {
				return action as ShortcutAction;
			}
		}
		return null;
	}

	private applyAction(action: ShortcutAction) {
		switch (action) {
			case 'wireMode':
				this.workMode.setWorkMode('buildWire');
				break;
			case 'connWireMode':
				this.workMode.setWorkMode('connectWire');
				break;
			case 'selectMode':
				this.workMode.setWorkMode('select');
				break;
			case 'cutSelectMode':
				this.workMode.setWorkMode('selectCut');
				break;
			case 'eraserMode':
				this.workMode.setWorkMode('eraser');
				break;
			case 'textMode':
				this.workMode.setWorkMode('text');
				break;
			case 'delete':
				this.projectInteraction.deleteSelection();
				break;
			case 'copy':
				this.projectInteraction.copySelection();
				break;
			case 'cut':
				this.projectInteraction.cutSelection();
				break;
			case 'paste':
				this.projectInteraction.paste();
				break;
			case 'zoomIn':
				this.projectInteraction.zoomIn();
				break;
			case 'zoomOut':
				this.projectInteraction.zoomOut();
				break;
			case 'zoom100':
				this.projectInteraction.zoom100();
				break;
			case 'fullscreen':
				this.theming.requestFullscreen();
				break;
			case 'undo':
				this.projectInteraction.undoForCurrent();
				break;
			case 'redo':
				this.projectInteraction.redoForCurrent();
				break;
			case 'save':
				this.projectInteraction.saveAll();
				break;
			case 'newProj':
				this.projectInteraction.newProject();
				break;
			case 'openProj':
				this.projectInteraction.openProject();
				break;
			case 'newComp':
				this.projectInteraction.newComponent();
				break;
			case 'enterSim':
				if (checkActionUsable('enterSim'))
					this.workMode.enterSimulation();
				break;
			case 'leaveSim':
				if (checkActionUsable('leaveSim')) {
					this.renderTicker.stopAllContSim();
					this.workMode.leaveSimulation();
				}
				break;
		}
	}
}
