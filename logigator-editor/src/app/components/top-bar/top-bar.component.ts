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
	public dropdownOpen: 'edit' | 'file' | 'view' | 'help' | 'settings' = null;

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

	public openDropdown(
		dropdown: 'edit' | 'file' | 'view' | 'help' | 'settings'
	) {
		this.dropdownOpen = dropdown;
	}

	public closeDropdowns() {
		this.dropdownOpen = null;
	}

	public switchDropdownIfActive(
		dropdown: 'edit' | 'file' | 'view' | 'help' | 'settings'
	) {
		if (this.dropdownOpen) {
			this.openDropdown(dropdown);
		}
	}

	public toggleDropdown(
		dropdown: 'edit' | 'file' | 'view' | 'help' | 'settings'
	) {
		if (this.dropdownOpen === dropdown) {
			this.closeDropdowns();
		} else {
			this.openDropdown(dropdown);
		}
	}
}
