import { Component } from '@angular/core';
import { ProjectsService } from '../../services/projects/projects.service';
import { UserService } from '../../services/user/user.service';
import { Observable } from 'rxjs';
import { User } from '../../models/http/response/user';
import { WorkMode } from '../../models/work-modes';
import { WorkModeService } from '../../services/work-mode/work-mode.service';
import { environment } from '../../../environments/environment';

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
		private projectService: ProjectsService,
		private userService: UserService,
		private workMode: WorkModeService
	) {}

	public get isSimulationMode(): boolean {
		return this.workMode.currentWorkMode === WorkMode.SIMULATION;
	}

	public get userInfo$(): Observable<User> {
		return this.userService.userInfo$;
	}

	public login() {
		window.open('/login', '_blank');
	}

	public register() {
		window.open('/register', '_blank');
	}

	public get mainProjectName(): string {
		if (!this.projectService.mainProject) return '';
		return this.projectService.mainProject.name;
	}

	public dropdownHover(comp: keyof TopBarComponent) {
		if (
			this.editDropdownOpen ||
			this.fileDropdownOpen ||
			this.viewDropdownOpen ||
			this.helpDropdownOpen
		) {
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
		return (
			this.editDropdownOpen ||
			this.fileDropdownOpen ||
			this.viewDropdownOpen ||
			this.helpDropdownOpen ||
			this.settingsDropdownOpen
		);
	}
}
