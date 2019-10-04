import { Injectable } from '@angular/core';
import {defaultShortcuts} from './default-shortcuts';
import {ShortcutAction, ShortcutConfig, ShortcutMap} from '../../models/shortcut-map';
import {WorkModeService} from '../work-mode/work-mode.service';
import {ProjectInteractionService} from '../project-interaction/project-interaction.service';
import {ProjectsService} from '../projects/projects.service';
import {ThemingService} from '../theming/theming.service';
import {shortcutDescriptions, shortcutsUsableInSimulation} from './shortcut-descriptions';
import {PopupService} from '../popup/popup.service';
import {NewComponentComponent} from '../../components/popup/popup-contents/new-component/new-component.component';

@Injectable({
	providedIn: 'root'
})
export class ShortcutsService {

	private _shortcutMap: ShortcutMap = defaultShortcuts;

	constructor(
		private workMode: WorkModeService,
		private projectInteraction: ProjectInteractionService,
		private projects: ProjectsService,
		private theming: ThemingService,
		private popup: PopupService
	) {
		this.loadShortcutSettings();
	}

	private loadShortcutSettings() {
		// TODO: load
	}

	public setShortcutConfig(newConfig: {[key: string]: ShortcutConfig}) {
		this._shortcutMap = {
			...this.shortcutMap,
			...newConfig
		};
		// TODO: save new config to server
	}

	public keyDownListener(e: KeyboardEvent) {
		const action = this.getShortcutActionFromEvent(e);
		if (!action || (this.workMode.currentWorkMode === 'simulation' && !shortcutsUsableInSimulation[action])) return;
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

		let key = config.key.toUpperCase();
		if (key === ' ') key = 'SPACE';

		return result + key;
	}

	public get shortcutMap(): ShortcutMap {
		return this._shortcutMap;
	}

	public getShortcutDescription(action: ShortcutAction) {
		return shortcutDescriptions[action];
	}

	public getShortcutConfigFromEvent(event: KeyboardEvent): ShortcutConfig {
		return {
			key: event.key.toUpperCase(),
			shift: event.shiftKey,
			ctrl: event.ctrlKey,
			alt: event.altKey
		};
	}

	private getShortcutActionFromEvent(e: KeyboardEvent): ShortcutAction | null {
		for (const action in this._shortcutMap) {
			const shortcutConfig = this._shortcutMap[action];
			if (shortcutConfig &&
				e.key.toUpperCase() === shortcutConfig.key.toUpperCase() &&
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
			case 'textMode':
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
				this.projects.currProject.stepBack();
				break;
			case 'redo':
				this.projects.currProject.stepForward();
				break;
			case 'save':
				this.projects.saveAll();
				break;
			case 'newComp':
				this.popup.showPopup(NewComponentComponent, 'New Component', false);
				break;
		}
	}
}
