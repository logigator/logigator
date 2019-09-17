import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ThemingService} from '../../../services/theming/theming.service';

@Component({
	selector: 'app-settings-dropdown',
	templateUrl: './settings-dropdown.component.html',
	styleUrls: ['./settings-dropdown.component.scss']
})
export class SettingsDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	public isDark = this.theming.currentTheme === 'dark';

	constructor(private theming: ThemingService) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public setTheme() {
		if (this.isDark) {
			this.theming.setTheme('light');
			this.isDark = false;
		} else {
			this.theming.setTheme('dark');
			this.isDark = true;
		}
	}
}
