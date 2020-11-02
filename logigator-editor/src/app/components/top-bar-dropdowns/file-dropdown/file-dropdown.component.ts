import {ChangeDetectionStrategy, Component, EventEmitter, Output} from '@angular/core';
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
export class FileDropdownComponent {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(
		private editorInteractionService: EditorInteractionService,
		private user: UserService,
		private projects: ProjectsService,
		private imageExportService: ImageExportService
	) { }

	public close() {
		this.requestClosed.emit();
	}

	public get canClone(): boolean {
		return this.projects.mainProject.source === 'share' && this.user.isLoggedIn;
	}

	public get canSave(): boolean {
		return this.projects.mainProject.source !== 'share';
	}

	public get canExportProject() {
		return this.projects.mainProject.source !== 'share';
	}

	public get canShare(): boolean {
		return this.projects.mainProject.source === 'server' && this.user.isLoggedIn;
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
		this.editorInteractionService.saveProject();
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

	public cloneProject() {
		// this.projects.cloneShare();
		this.close();
	}

	public screenshot(type: 'jpeg' | 'png' | 'svg') {
		this.imageExportService.exportImage(type);
		this.close();
	}
}
