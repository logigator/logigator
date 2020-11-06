import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {PopupContentComp} from '../../popup/popup-content-comp';
import {Project} from '../../../models/project';
import {ApiService} from '../../../services/api/api.service';
import {environment} from '../../../../environments/environment';
import {ProjectInfo} from '../../../models/http/response/project-info';
import {ProjectSaveManagementService} from '../../../services/project-save-management/project-save-management.service';

@Component({
	selector: 'app-share-project',
	templateUrl: './share-project.component.html',
	styleUrls: ['./share-project.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareProjectComponent extends PopupContentComp<Project, never> implements OnInit {

	public isPublic: boolean;

	public link: string;

	constructor(
		private api: ApiService,
		private projectSaveManagement: ProjectSaveManagementService,
		private cdr: ChangeDetectorRef
	) {
		super();
	}

	async ngOnInit() {
		this.isPublic = this.inputFromOpener.isPublic;
		this.link = this.getShareLink(this.inputFromOpener.link);

	}

	public copyLink() {
		const textArea = document.createElement('textarea');
		textArea.value = this.link;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		textArea.remove();
	}

	public async regenerateLink() {
		const resp = await this.api.patch<ProjectInfo>(`/project/${this.getProjectUuid()}`, {
			updateLink: true
		}, {errorMessage: 'ERROR.PROJECTS.REGENERATE_SHARE_LINK'}).toPromise();
		this.inputFromOpener.link = resp.data.link;
		this.link = this.getShareLink(resp.data.link);
		this.cdr.detectChanges();
	}

	public async saveClick() {
		if (this.inputFromOpener.isPublic === this.isPublic) {
			this.requestClose.emit();
			return;
		}
		const resp = await this.api.patch<ProjectInfo>(`/project/${this.getProjectUuid()}`, {
			public: this.isPublic
		}, {errorMessage: 'ERROR.PROJECTS.UPDATE_SHARE_INFO'}).toPromise();
		this.inputFromOpener.isPublic = resp.data.public;
		this.requestClose.emit();
	}

	public cancelClick() {
		this.requestClose.emit();
	}

	private getProjectUuid(): string {
		return this.projectSaveManagement.getUuidForProject(this.inputFromOpener.id);
	}

	private getShareLink(linkId: string): string {
		return environment.url + '/share/' + linkId;
	}

}
