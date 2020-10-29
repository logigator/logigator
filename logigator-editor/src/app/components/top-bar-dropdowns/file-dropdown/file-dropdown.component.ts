import {ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {UserService} from '../../../services/user/user.service';
import {ProjectsService} from '../../../services/projects/projects.service';
import {ImageExportService} from '../../../services/image-export/image-export.service';
import {EditorInteractionService} from '../../../services/editor-interaction/editor-interaction.service';

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
		private editorInteractionService: EditorInteractionService,
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
		return true;
		// return this.projectSaveService.isShare && this.user.isLoggedIn;
	}

	public get canSave(): boolean {
		return true;
		// return this.user.isLoggedIn && !this.projectSaveService.isShare;
	}

	public newProject() {
		this.close();
		this.editorInteractionService.newProject();
	}

	public newComponent() {
		this.editorInteractionService.newComponent();
		this.close();
	}

	public openProject() {
		this.close();
		this.editorInteractionService.openProject();
	}

	public saveProject() {
		this.projects.saveAllProjects();
		this.close();
	}

	public async exportProject() {
		await this.editorInteractionService.exportToFile();
		this.close();
	}

	public shareProject() {
		this.editorInteractionService.shareProject();
		this.close();
	}

	public get canShare(): boolean {
		return true;
		// return this.projectSaveService.isFromServer;
	}

	public cloneProject() {
		// this.projects.cloneShare();
		this.close();
	}

	public screenshot(type: 'jpeg' | 'png' | 'svg') {
		this.imageExportService.exportImage(type);
		this.close();
	}
}
