import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	OnInit,
	ViewChild,
	ViewContainerRef
} from '@angular/core';
import { PopupContentComp } from '../../popup/popup-content-comp';
import { Project } from '../../../models/project';
import { ApiService } from '../../../services/api/api.service';
import { environment } from '../../../../environments/environment';
import { ProjectInfo } from '../../../models/http/response/project-info';
import { ProjectSaveManagementService } from '../../../services/project-save-management/project-save-management.service';
import { LoadingService } from '../../../services/loading/loading.service';

@Component({
	selector: 'app-share-project',
	templateUrl: './share-project.component.html',
	styleUrls: ['./share-project.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareProjectComponent
	extends PopupContentComp<Project, never>
	implements OnInit
{
	public isPublic: boolean;

	public link: string;

	@ViewChild('loadingRef', { read: ViewContainerRef, static: true })
	private _loadingRef: ViewContainerRef;

	constructor(
		private api: ApiService,
		private projectSaveManagement: ProjectSaveManagementService,
		private cdr: ChangeDetectorRef,
		private loadingService: LoadingService
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
		const removeLoading = this.loadingService.add(
			'LOADING.SHARE_REGENERATE_LINK',
			this._loadingRef,
			true
		);
		try {
			const resp = await this.api
				.patch<ProjectInfo>(
					`/project/${this.getProjectUuid()}`,
					{
						updateLink: true
					},
					{ errorMessage: 'ERROR.PROJECTS.REGENERATE_SHARE_LINK' }
				)
				.toPromise();
			this.inputFromOpener.link = resp.data.link;
			this.link = this.getShareLink(resp.data.link);
		} finally {
			removeLoading();
			this.cdr.detectChanges();
		}
	}

	public async saveClick() {
		if (this.inputFromOpener.isPublic === this.isPublic) {
			this.requestClose.emit();
			return;
		}
		const removeLoading = this.loadingService.add(
			'LOADING.UPDATE_SHARE_INFO',
			this._loadingRef,
			true
		);
		try {
			const resp = await this.api
				.patch<ProjectInfo>(
					`/project/${this.getProjectUuid()}`,
					{
						public: this.isPublic
					},
					{ errorMessage: 'ERROR.PROJECTS.UPDATE_SHARE_INFO' }
				)
				.toPromise();
			this.inputFromOpener.isPublic = resp.data.public;
			this.requestClose.emit();
		} finally {
			removeLoading();
		}
	}

	public cancelClick() {
		this.requestClose.emit();
	}

	private getProjectUuid(): string {
		return this.projectSaveManagement.getUuidForProject(
			this.inputFromOpener.id
		);
	}

	private getShareLink(linkId: string): string {
		return environment.url + '/share/' + linkId;
	}
}
