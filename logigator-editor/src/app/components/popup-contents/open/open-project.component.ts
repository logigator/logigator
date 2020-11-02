import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {UserService} from '../../../services/user/user.service';
import {Observable, Subject} from 'rxjs';
import {PopupContentComp} from '../../popup/popup-content-comp';
import {ProjectSaveManagementService} from '../../../services/project-save-management/project-save-management.service';
import {ProjectList} from '../../../models/http/response/project-list';
import {debounceTime, map, tap} from 'rxjs/operators';

@Component({
	selector: 'app-open-project',
	templateUrl: './open-project.component.html',
	styleUrls: ['./open-project.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpenProjectComponent extends PopupContentComp<never, {type: 'server' | 'local' | 'share', data: any }> implements OnInit {

	public fileToOpen: File;

	public shareLinkId: string;

	public searchText: string;

	public projectsList: ProjectList;

	public paginationButtons: {
		hidden: boolean;
		disabled: boolean;
		active: boolean;
		value: string;
		target: number;
	}[] = [];

	private searchTextChange = new Subject<void>();

	constructor(
		private user: UserService,
		private projectSave: ProjectSaveManagementService,
		private cdr: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		if (!this.isLoggedIn)
			return;

		this.getProjectList(0);
		this.searchTextChange.pipe(
			debounceTime(500)
		).subscribe(() => this.getProjectList(0));
	}

	public get isLoggedIn(): boolean {
		return this.user.isLoggedIn;
	}

	public searchTextChanged() {
		this.searchTextChange.next();
	}

	private async getProjectList(page?: number) {
		this.projectsList = await this.projectSave.getProjectsInfo(page, this.searchText !== '' ? this.searchText : undefined).pipe(
			map(resp => resp.data)
		).toPromise();
		this.updatePagination();
		this.cdr.detectChanges();
	}

	public pageButtonClick(targetPage: number) {
		this.getProjectList(targetPage);
	}

	private updatePagination() {
		if (this.paginationButtons.length === 0) {
			this.paginationButtons = Array.from(Array(7), (v, index) => {
				const button = {
					hidden: false,
					disabled: false,
					active: false,
					value: '',
					target: 0
				};
				switch (index) {
					case 0:
						button.value = '<<';
						break;
					case 1:
						button.value = '<';
						break;
					case 5:
						button.value = '>';
						break;
					case 6:
						button.value = '>>';
						break;
				}
				return button;
			});
		}

		const pageButtonTargets = new Array(7);

		pageButtonTargets[0] = this.projectsList.page > 0 ? 0 : undefined;
		pageButtonTargets[1] = this.projectsList.page > 0 ? this.projectsList.page - 1 : undefined;

		pageButtonTargets[2] = undefined;
		pageButtonTargets[3] = undefined;
		pageButtonTargets[4] = undefined;

		let from;
		let to;
		if (this.projectsList.page === 0) {
			from = 0;
			to = this.projectsList.total > 3 ? 3 : this.projectsList.total - 1;
		} else if (this.projectsList.page === this.projectsList.total - 1) {
			from = Math.max(this.projectsList.total - 3, 0);
			to = this.projectsList.total - 1;
		} else {
			from = this.projectsList.page - 1;
			to = this.projectsList.page + 1;
		}
		for (let page = from, i = 2; page <= to; page++, i++) {
			pageButtonTargets[i] = page;
		}

		pageButtonTargets[5] = this.projectsList.page < this.projectsList.total - 1 ? this.projectsList.page + 1 : undefined;
		pageButtonTargets[6] = this.projectsList.page < this.projectsList.total - 1 ? this.projectsList.total - 1 : undefined;

		this.paginationButtons.forEach((button, index) => {
			if (index <= 1 || index >= 5) {
				button.hidden = false;
				button.disabled = pageButtonTargets[index] === undefined;
			} else {
				button.disabled = false;
				button.hidden = pageButtonTargets[index] === undefined;
				button.active = pageButtonTargets[index] === this.projectsList.page;
				button.value = pageButtonTargets[index] + 1;
			}
			button.target = pageButtonTargets[index];
		});
	}


	public openServer(id: string) {
		this.requestClose.emit({type: 'server', data: id});
	}

	public openFile() {
		this.requestClose.emit({type: 'local', data: this.fileToOpen});
	}

	public openShare() {
		let address: string;
		if (this.shareLinkId.includes('/')) {
			address = this.shareLinkId.substring(this.shareLinkId.lastIndexOf('/') + 1);
		} else {
			address = this.shareLinkId;
		}
		this.requestClose.emit({type: 'share', data: address});
	}

}
