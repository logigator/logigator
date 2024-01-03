// @ts-strict-ignore
import { Component } from '@angular/core';
import { UserService } from '../../services/user/user.service';
import { Observable } from 'rxjs';
import { User } from '../../models/http/response/user';
import { environment } from '../../../environments/environment';
import { ProjectService } from '../../services/project/project.service';

@Component({
	selector: 'app-top-bar',
	templateUrl: './top-bar.component.html',
	styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent {
	public dropdownOpen: 'edit' | 'file' | 'view' | 'help' | 'settings' = null;

	public homeUrl = environment.homeUrl;

	constructor(
		private userService: UserService,
		private projectService: ProjectService
	) {}

	public get isSimulationMode(): boolean {
		// return this.workMode.currentWorkMode === WorkMode.SIMULATION;
		return false;
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
		return this.projectService.project.name;
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
