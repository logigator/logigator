import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {PopupContentComp} from '../../popup/popup-content-comp';
import {Project} from '../../../models/project';
import {ApiService} from '../../../services/api/api.service';

@Component({
	selector: 'app-share-project',
	templateUrl: './share-project.component.html',
	styleUrls: ['./share-project.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareProjectComponent extends PopupContentComp<Project, never> implements OnInit {

	public isPublic: boolean;

	public link: string;

	constructor(private api: ApiService) {
		super();
	}

	async ngOnInit() {
		// this.api.get()
	}

}
