import {Component, OnInit} from '@angular/core';
import {PopupContentComp} from '../../popup/popup-content-comp';
import {Project} from '../../../models/project';

@Component({
	selector: 'app-edit-component-plugs',
	templateUrl: './edit-component-plugs.component.html',
	styleUrls: ['./edit-component-plugs.component.scss']
})
export class EditComponentPlugsComponent extends PopupContentComp<Project, never> implements OnInit {

	constructor() {
		super();
	}

	ngOnInit(): void {
	}

}
