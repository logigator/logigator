import {Component, Optional} from '@angular/core';
import {ProjectsService} from '../../services/projects/projects.service';
import {UserService} from '../../services/user/user.service';
import {Observable} from 'rxjs';
import {ElectronService} from 'ngx-electron';
import {User} from '../../models/http/response/user';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {environment} from '../../../environments/environment';

@Component({
	selector: 'app-top-bar',
	templateUrl: './top-bar.component.html',
	styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent {

	public editDropdownOpen = false;
	public fileDropdownOpen = false;
	public viewDropdownOpen = false;
	public helpDropdownOpen = false;
	public settingsDropdownOpen = false;

	public homeUrl = environment.homeUrl;

	constructor(
		@Optional() private electronService: ElectronService,
		private projectService: ProjectsService,
		private userService: UserService,
		private workMode: WorkModeService
	) { }

	public get isSimulationMode(): boolean {
		return this.workMode.currentWorkMode === WorkMode.SIMULATION;
	}

	public get userInfo$(): Observable<User> {
		return this.userService.userInfo$;
	}

	public login() {
		// #!electron
		// TODO

		// #!web
		window.open('/login', '_blank');
	}

	public register() {
		// #!electron
		// TODO

		// #!web
		window.open('/register', '_blank');
	}

	// #!if ELECTRON === 'true'
	public minimize() {
		this.electronService.ipcRenderer.invoke('windowMinimize');
	}

	public maximizeWin() {
		this.electronService.ipcRenderer.invoke('windowMaximize');
	}

	public async close() {
		// const canClose = await this.projectService.askToSave();
		// if (canClose) {
		// 	this.electronService.ipcRenderer.invoke('windowClose');
		// }
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
