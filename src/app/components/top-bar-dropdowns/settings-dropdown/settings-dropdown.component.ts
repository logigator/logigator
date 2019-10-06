import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ThemingService} from '../../../services/theming/theming.service';
import {PopupService} from '../../../services/popup/popup.service';
import {ShortcutConfigComponent} from '../../popup/popup-contents/shortcut-config/shortcut-config/shortcut-config.component';
import {ReloadQuestionComponent} from '../../popup/popup-contents/relaod-question/reload-question.component';

@Component({
	selector: 'app-settings-dropdown',
	templateUrl: './settings-dropdown.component.html',
	styleUrls: ['./settings-dropdown.component.scss']
})
export class SettingsDropdownComponent {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	public showDropDown = true;

	constructor(public theming: ThemingService, private popupService: PopupService) {}

	public close() {
		this.requestClosed.emit();
	}

	public async showCustomizeShortcuts() {
		this.showDropDown = false;
		await this.popupService.showPopup(ShortcutConfigComponent, 'POPUP.SHORTCUTS.TITLE', false);
		this.close();
	}

	public async showReloadPopup() {
		this.showDropDown = false;
		await this.popupService.showPopup(ReloadQuestionComponent, 'POPUP.RELOAD.TITLE', false);
		this.close();
	}

	public changeGridVisibility() {
		this.theming.showGrid = !this.theming.showGrid;
	}
}
