import {ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ProjectSaveManagementService} from '../../../services/project-save-management/project-save-management.service';
import {ProjectInteractionService} from '../../../services/project-interaction/project-interaction.service';
import {UserService} from '../../../services/user/user.service';
import {ProjectsService} from '../../../services/projects/projects.service';
import {ImageExportService} from '../../../services/image-export/image-export.service';

@Component({
	selector: 'app-file-dropdown',
	templateUrl: './file-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './file-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(
		private projectSaveService: ProjectSaveManagementService,
		private projectInteraction: ProjectInteractionService,
		private user: UserService,
		private projects: ProjectsService,
		private imageExportService: ImageExportService
	) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public checkActionUsable(action: string) {
		return true;
		// return checkActionUsable(action);
		// TODO: fix
	}

	public get canClone(): boolean {
		return this.projectSaveService.isShare && this.user.isLoggedIn;
	}

	public get canSave(): boolean {
		return this.user.isLoggedIn && !this.projectSaveService.isShare;
	}

	public newProject() {
		this.close();
		this.projectInteraction.newProject();
	}

	public newComponent() {
		this.projectInteraction.newComponent();
		this.close();
	}

	public openProject() {
		this.close();
		this.projectInteraction.openProject();
	}

	public saveProject() {
		this.projectInteraction.saveAll();
		this.close();
	}

	public async exportProject() {
		await this.projectInteraction.exportToFile();
		this.close();
	}

	public shareProject() {
		this.projectInteraction.shareProject();
		this.close();
	}

	public get canShare(): boolean {
		return this.projectSaveService.isFromServer;
	}

	public cloneProject() {
		this.projects.cloneShare();
		this.close();
	}

	public screenshot(type: 'jpeg' | 'png' | 'svg') {
		this.imageExportService.exportImage(type);
		this.close();
	}
}
