import { Component, OnInit } from '@angular/core';
import {ThemingService} from '../../../../services/theming/theming.service';
import {PopupContentComp} from '../popup-content-comp';

@Component({
	selector: 'app-reload-question',
	templateUrl: './reload-question.component.html',
	styleUrls: ['./reload-question.component.scss']
})
export class ReloadQuestionComponent extends PopupContentComp implements OnInit {

	constructor(private theming: ThemingService) {
		super();
	}

	ngOnInit() {
	}

	public reloadPostponed() {
		this.setTheme();
		this.requestClose.emit();
	}

	public reloadConfirm() {
		this.setTheme();
		window.location.reload();
	}

	public close() {
		this.requestClose.emit();
	}

	private setTheme() {
		if (this.theming.pendingTheme === 'dark') {
			this.theming.setTheme('light');
		} else {
			this.theming.setTheme('dark');
		}
	}

}
