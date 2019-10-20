import { Component, OnInit } from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {ProjectsService} from '../../../../services/projects/projects.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';

@Component({
	selector: 'app-share-project',
	templateUrl: './share-project.component.html',
	styleUrls: ['./share-project.component.scss']
})
export class ShareProjectComponent extends PopupContentComp implements OnInit {

	public addedEmails: string[] = [];
	public addEmailFrom: FormGroup;

	public link: string = 'asdsaddsfsdajhfghsdlkghksdfjg,mjdhfsjghdkjsfhgkjdfhskjghdskjghkjasd';

	public sharing = false;
	public public = false;

	constructor(private projects: ProjectsService, private fromBuilder: FormBuilder) {
		super();
	}

	ngOnInit() {
		this.addEmailFrom = this.fromBuilder.group({
			email: ['', [Validators.email, Validators.required]]
		});
	}

	addEmail() {
		if (this.addEmailFrom.invalid) return;
		this.addedEmails.push(this.addEmailFrom.controls.email.value);
		this.addEmailFrom.reset();
	}

	removeMail(index: number) {
		this.addedEmails.splice(index, 1);
	}

}
