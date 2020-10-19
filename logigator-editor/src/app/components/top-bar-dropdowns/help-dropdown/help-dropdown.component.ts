import {ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {HelpComponent} from '../../popup-contents/help/help.component';
import {PopupService} from '../../../services/popup/popup.service';

@Component({
	selector: 'app-help-dropdown',
	templateUrl: './help-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './help-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(private popupService: PopupService) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public help() {
		this.popupService.showPopup(HelpComponent, 'POPUP.HELP.TITLE', true);
		this.close();
	}
}
