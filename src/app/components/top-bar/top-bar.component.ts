import {Component, OnInit, Optional} from '@angular/core';
import {ProjectsService} from '../../services/projects/projects.service';
import {UserService} from '../../services/user/user.service';
import {Observable} from 'rxjs';
import {UserInfo} from '../../models/http-responses/user-info';
import { ElectronService } from 'ngx-electron';
// #!electron
import {LoginPopupComponent} from '@logigator/logigator-shared-comps';
// #!electron
import {RegisterPopupComponent} from '@logigator/logigator-shared-comps';
import {InteractionAction} from '../../models/interaction-action';
import {checkActionUsable} from '../../models/action-usable-in-modes';
import {PopupService} from '@logigator/logigator-shared-comps';


@Component({
	selector: 'app-top-bar',
	templateUrl: './top-bar.component.html',
	styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent implements OnInit {

	public editDropdownOpen = false;
	public fileDropdownOpen = false;
	public viewDropdownOpen = false;
	public helpDropdownOpen = false;
	public settingsDropdownOpen = false;

	constructor(
		@Optional() private electronService: ElectronService,
		private projectService: ProjectsService,
		private userService: UserService,
		private popup: PopupService
	) { }

	ngOnInit() {}

	public checkActionUsable(action: InteractionAction) {
		return checkActionUsable(action);
	}

	public get userInfo$(): Observable<UserInfo> {
		return this.userService.userInfo$;
	}

	public login() {
		// #!electron
		this.popup.showPopup(LoginPopupComponent, null, 'Login', true);

		// #!web
		window.open('https://logigator.com/login', '_blank');
	}

	public register() {
		// #!electron
		this.popup.showPopup(RegisterPopupComponent, null, 'Register', true);

		// #!web
		window.open('https://logigator.com/register', '_blank');
	}

	// #!if ELECTRON === 'true'
	public minimize() {
		this.electronService.remote.getCurrentWindow().minimize();
	}

	maximizeWin() {
		if (this.electronService.remote.getCurrentWindow().isMaximized()) {
			this.electronService.remote.getCurrentWindow().unmaximize();
		} else {
			this.electronService.remote.getCurrentWindow().maximize();
		}
	}

	async close() {
		const canClose = await this.projectService.askToSave();
		if (canClose) {
			this.electronService.remote.getCurrentWindow().close();
		}
	}
	// #!endif

	public get mainProjectName(): string {
		if (!this.projectService.mainProject) return '';
		return this.projectService.mainProject.name;
	}

	public dropdownHover(comp: keyof TopBarComponent) {
		if (this.editDropdownOpen || this.fileDropdownOpen || this.viewDropdownOpen || this.helpDropdownOpen) {
			this.closeDropdowns();
			// @ts-ignore
			this[comp] = true;
		}
	}

	public closeDropdowns() {
		this.editDropdownOpen = false;
		this.fileDropdownOpen = false;
		this.viewDropdownOpen = false;
		this.helpDropdownOpen = false;
		this.settingsDropdownOpen = false;
	}

	public get dropdownOpen(): boolean {
		return this.editDropdownOpen || this.fileDropdownOpen || this.viewDropdownOpen || this.helpDropdownOpen || this.settingsDropdownOpen;
	}

}
