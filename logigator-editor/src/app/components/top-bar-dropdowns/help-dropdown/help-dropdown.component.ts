import {ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {HelpComponent} from '../../popup-contents/help/help.component';
import {PopupService} from '../../../services/popup/popup.service';
import {HexBinDecConverterComponent} from '../../popup-contents/hex-bin-dec-converter/hex-bin-dec-converter.component';
import {TutorialService} from '../../../services/tutorial/tutorial.service';
import {Tutorial} from '../../../models/tutorial';

@Component({
	selector: 'app-help-dropdown',
	templateUrl: './help-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './help-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelpDropdownComponent {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(private popupService: PopupService, private tutorialService: TutorialService) { }

	public get tutorials(): Tutorial[] {
		return this.tutorialService.allTutorials;
	}

	public close() {
		this.requestClosed.emit();
	}

	public help() {
		this.popupService.showPopup(HelpComponent, 'POPUP.HELP.TITLE', true);
		this.close();
	}

	public tutorialClick(id: string) {
		this.tutorialService.manuallyStartTutorial(id);
		this.close();
	}

	public hexBinDec() {
		this.popupService.showPopup(HexBinDecConverterComponent, 'POPUP.HEX_BIN_DEC.TITLE', false);
		this.close();
	}
}
