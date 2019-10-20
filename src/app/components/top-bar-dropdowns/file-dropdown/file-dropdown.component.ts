import {ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ProjectsService} from '../../../services/projects/projects.service';
import {ProjectSaveManagementService} from '../../../services/project-save-management/project-save-management.service';
import {OpenProjectComponent} from '../../popup/popup-contents/open/open-project.component';
import {PopupService} from '../../../services/popup/popup.service';
import {NewComponentComponent} from '../../popup/popup-contents/new-component/new-component.component';
import {ShareProjectComponent} from '../../popup/popup-contents/share-project/share-project.component';

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
		private projectsService: ProjectsService,
		private projectSave: ProjectSaveManagementService,
		private popupService: PopupService,
		private projectSaveService: ProjectSaveManagementService
	) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public async newProject() {
		this.close();
		if (await this.projectsService.askToSave()) {
			await this.projectsService.newProject();
		}
	}

	public newComponent() {
		this.popupService.showPopup(NewComponentComponent, 'POPUP.NEW_COMP.TITLE', false);
		this.close();
	}

	public async openProject() {
		this.close();
		if (await this.projectsService.askToSave()) {
			this.popupService.showPopup(OpenProjectComponent, 'POPUP.OPEN.TITLE', true);
		}
	}

	public saveProject() {
		this.projectsService.saveAll();
		this.close();
	}

	public exportProject() {
		this.projectSave.exportToFile(this.projectsService.mainProject);
		this.close();
	}

	public shareProject() {
		this.popupService.showPopup(ShareProjectComponent, 'POPUP.SHARE.TITLE', false, null, {project: this.projectsService.mainProject.name});
		this.close();
	}

	public get canShare(): boolean {
		return this.projectSaveService.isFromServer;
	}

	public screenshot() {
		this.close();
	}
}
