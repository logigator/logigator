import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	OnInit,
	Optional,
	Output
} from '@angular/core';
import { ThemingService } from '../../../services/theming/theming.service';
import { ShortcutConfigComponent } from '../../popup-contents/shortcut-config/shortcut-config/shortcut-config.component';
import { ReloadQuestionComponent } from '../../popup-contents/reload-question/reload-question.component';
import { TranslateService } from '@ngx-translate/core';
import { UserService } from '../../../services/user/user.service';
import { ProjectsService } from '../../../services/projects/projects.service';
import { PopupService } from '../../../services/popup/popup.service';
import { environment } from '../../../../environments/environment';
import { SimulationManagementService } from '../../../services/simulation/simulation-management/simulation-management.service';

@Component({
	selector: 'app-settings-dropdown',
	templateUrl: './settings-dropdown.component.html',
	styleUrls: ['./settings-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsDropdownComponent implements OnInit {
	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	public showDropDown = true;
	public currentLang: string;

	constructor(
		public theming: ThemingService,
		public simulationMgmt: SimulationManagementService,
		private popupService: PopupService,
		private translation: TranslateService,
		private user: UserService,
		private projects: ProjectsService
	) {}

	ngOnInit(): void {
		this.currentLang = this.translation.currentLang;
	}

	public get isLoggedIn(): boolean {
		return this.user.isLoggedIn;
	}

	public languageChange() {
		this.translation.use(this.currentLang);
	}

	public close() {
		this.requestClosed.emit();
	}

	public async showCustomizeShortcuts() {
		this.showDropDown = false;
		await this.popupService.showPopup(
			ShortcutConfigComponent,
			'POPUP.SHORTCUTS.TITLE',
			false
		);
		this.close();
	}

	public accountSettings() {
		window.open(`${environment.homeUrl}/my/account/profile`, '_blank');
	}

	public privacyPolicy() {
		window.open(`${environment.homeUrl}/privacy-policy`, '_blank');
	}

	public async showReloadPopup() {
		this.showDropDown = false;
		await this.popupService.showPopup(
			ReloadQuestionComponent,
			'POPUP.RELOAD.TITLE',
			false
		);
		this.close();
	}
}
