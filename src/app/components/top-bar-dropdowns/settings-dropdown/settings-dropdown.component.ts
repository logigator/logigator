import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ThemingService} from '../../../services/theming/theming.service';
import {ShortcutMap} from '../../../models/shortcut-map';
import {ShortcutsService} from '../../../services/shortcuts/shortcuts.service';

@Component({
	selector: 'app-settings-dropdown',
	templateUrl: './settings-dropdown.component.html',
	styleUrls: ['./settings-dropdown.component.scss']
})
export class SettingsDropdownComponent {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	public showDropDown = true;

	public reloadPopupActive = false;
	public changeShortcutPopupActive = false;

	constructor(public theming: ThemingService) {}

	public close() {
		this.requestClosed.emit();
	}

	public shortcutSettingsClose() {
		this.close();
		this.changeShortcutPopupActive = false;
	}

	public reloadClose() {
		this.close();
		this.reloadPopupActive = false;
	}

	public reloadPostponed() {
		this.setTheme();
		this.reloadClose();
	}

	public reloadConfirm() {
		this.setTheme();
		window.location.reload();
	}

	private setTheme() {
		if (this.theming.pendingTheme === 'dark') {
			this.theming.setTheme('light');
		} else {
			this.theming.setTheme('dark');
		}
	}
}
