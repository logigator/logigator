import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {PopupContentComp} from '../popup-content-comp';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {SharingService} from '../../../../services/sharing/sharing.service';
import {ProjectsService} from '../../../../services/projects/projects.service';

@Component({
	selector: 'app-share-project',
	templateUrl: './share-project.component.html',
	styleUrls: ['./share-project.component.scss']
})
export class ShareProjectComponent extends PopupContentComp implements OnInit {

	public addedEmails: string[] = [];
	public addEmailFrom: FormGroup;

	public link: string;

	public sharing = false;
	public public = true;
	public sendInvitations = false;

	public errors: string[];

	constructor(
		private fromBuilder: FormBuilder,
		private sharingSer: SharingService,
		private projects: ProjectsService,
		private cdr: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		this.addEmailFrom = this.fromBuilder.group({
			email: ['', [Validators.email, Validators.required, this.uniqueEmailValidator.bind(this)]]
		});
	}

	private uniqueEmailValidator(control: AbstractControl): {[key: string]: any} | null {
		if (this.addedEmails.includes(control.value)) return {alreadySet: true};
		return null;
	}

	public get canSave(): boolean {
		if (!this.public) {
			return this.addedEmails.length > 0;
		}
		return true;
	}

	addEmail() {
		if (this.addEmailFrom.invalid) return;
		this.addedEmails.push(this.addEmailFrom.controls.email.value);
		this.addEmailFrom.reset();
	}

	removeMail(index: number) {
		this.addedEmails.splice(index, 1);
	}

	public copyLink() {
		const textArea = document.createElement('textarea');
		textArea.value = this.link;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		textArea.remove();
	}

	public async save() {
		if (!this.canSave) return;
		try {
			const link = await this.sharingSer.saveSettings(this.sharing, {
				project: this.projects.mainProject.id,
				invitations: this.sendInvitations,
				users: this.public ? undefined : this.addedEmails
			});
			console.log(link);
			if (link === undefined) this.requestClose.emit();
			this.link = link;
			delete this.errors;
		} catch (e) {
			this.errors = e;
		} finally {
			this.cdr.detectChanges();
		}
	}

	public cancel() {
		this.requestClose.emit();
	}

}
