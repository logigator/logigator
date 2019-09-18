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

	public reloadPopupActive = '';

	constructor(private theming: ThemingService) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public reloadClose() {
		this.reloadPopupActive = '';
	}

	public reloadPostponed() {
		this.processPending();
		this.reloadClose();
	}

	public reloadConfirm() {
		this.processPending();
		window.location.reload();
	}

	private setTheme() {
		if (this.theming.pendingTheme === 'dark') {
			this.theming.setTheme('light');
		} else {
			this.theming.setTheme('dark');
		}
	}

	private processPending() {
		switch (this.reloadPopupActive) {
			case 'theme':
				this.setTheme();
				break;
		}
	}
}
