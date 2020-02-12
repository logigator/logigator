import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {ProjectsService} from '../../../services/projects/projects.service';
import {UserService} from '../../../services/user/user.service';
import {ProjectSaveManagementService} from '../../../services/project-save-management/project-save-management.service';
import {Observable} from 'rxjs';
import {ProjectInfoResponse} from '../../../models/http-responses/project-info-response';
import {PopupContentComp} from '@logigator/logigator-shared-comps';

@Component({
	selector: 'app-open-project',
	templateUrl: './open-project.component.html',
	styleUrls: ['./open-project.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpenProjectComponent extends PopupContentComp implements OnInit {

	public fileToOpen: File;
	public allProjectsInfo: Observable<ProjectInfoResponse[]>;

	constructor(
		private projects: ProjectsService,
		private user: UserService,
		private projectSave: ProjectSaveManagementService
	) {
		super();
	}

	ngOnInit() {
		this.allProjectsInfo = this.projectSave.getAllProjectsInfoFromServer();
	}

	public get isLoggedIn(): boolean {
		return this.user.isLoggedIn;
	}

	public openServer(project: ProjectInfoResponse) {
		this.projects.openProjectServer(Number(project.pk_id));
		this.requestClose.emit();
	}

	public openFile() {
		if (this.fileToOpen.type !== 'application/json') return;
		const reader = new FileReader();
		reader.readAsText(this.fileToOpen, 'UTF-8');
		reader.onload = (event: any) => {
			this.projects.openFile(event.target.result);
			this.requestClose.emit();
		};
	}

}
