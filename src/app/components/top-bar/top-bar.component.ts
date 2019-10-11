import {Component, OnInit} from '@angular/core';
import {ProjectsService} from '../../services/projects/projects.service';
import {UserService} from '../../services/user/user.service';
import {Observable} from 'rxjs';
import {UserInfo} from '../../models/http-responses/user-info';
// #!electron
import { ElectronService } from 'ngx-electron';

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
		// #!electron
		private electronService: ElectronService,
		private projectService: ProjectsService,
		private userService: UserService
	) { }

	ngOnInit() {}

	public get userInfo$(): Observable<UserInfo> {
		return this.userService.userInfo$;
	}

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

}
