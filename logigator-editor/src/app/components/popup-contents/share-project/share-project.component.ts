import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {SharingService} from '../../../services/sharing/sharing.service';
import {ProjectsService} from '../../../services/projects/projects.service';
import {environment} from '../../../../environments/environment';
import {PopupContentComp} from '@logigator/logigator-shared-comps';

@Component({
	selector: 'app-share-project',
	templateUrl: './share-project.component.html',
	styleUrls: ['./share-project.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareProjectComponent extends PopupContentComp implements OnInit {

	public isNewShare;

	public addedUsers: string[] = [];
	public addUserFrom: FormGroup;

	public address: string;

	public sharing = false;
	public public = true;
	public sendInvitations = false;

	public error = false;
	public success = false;

	private removeErrorSuccessTimeout: any;

	constructor(
		private fromBuilder: FormBuilder,
		private sharingSer: SharingService,
		private projects: ProjectsService,
		private cdr: ChangeDetectorRef
	) {
		super();
	}

	async ngOnInit() {
		this.addUserFrom = this.fromBuilder.group({
			user: ['', [Validators.required, this.uniqueUserValidator.bind(this)]]
		});
		const shareSettings = await this.sharingSer.getShareSettings(this.projects.mainProject.id);
		if (!shareSettings) {
			this.isNewShare = true;
			this.cdr.detectChanges();
			return;
		}
		this.sharing = true;
		this.isNewShare = false;
		this.public = shareSettings.is_public as boolean;
		this.address = shareSettings.address;
		this.addedUsers = shareSettings.users.map(u => u.email);
		this.cdr.detectChanges();
	}

	private uniqueUserValidator(control: AbstractControl): {[key: string]: any} | null {
		if (this.addedUsers.includes(control.value)) return {alreadySet: true};
		return null;
	}

	addUser() {
		if (this.addUserFrom.invalid) return;
		this.addedUsers.push(this.addUserFrom.controls.user.value);
		this.addUserFrom.reset();
	}

	removeUser(index: number) {
		this.addedUsers.splice(index, 1);
	}

	public copyLink() {
		const textArea = document.createElement('textarea');
		textArea.value = this.getLinkFromShareAddress(this.address);
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		textArea.remove();
	}

	public get canSave(): boolean {
		if (this.sharing && !this.public) {
			return this.addedUsers.length > 0;
		}
		return true;
	}

	public async save() {
		if (!this.canSave) return;
		if (this.isNewShare) {
			if (!this.sharing) {
				this.requestClose.emit();
				return;
			}
			const resp = await this.sharingSer.createShare({
				project: this.projects.mainProject.id,
				invitations: this.sendInvitations,
				users: this.public ? undefined : this.addedUsers
			});
			if (!resp) return;
			this.isNewShare = false;
			this.address = resp.result.address;
			this.processReceivedWarnings(resp.warnings);
		} else {
			if (this.sharing) {
				const resp = await this.sharingSer.updateShare({
					invitations: this.sendInvitations,
					is_public: this.public,
					users: this.addedUsers
				}, this.address);
				this.processReceivedWarnings(resp.warnings);
			} else {
				const resp = await this.sharingSer.deleteShare(this.address);
				if (!resp) return;
				this.isNewShare = true;
				delete this.address;
				this.addedUsers = [];
				this.processReceivedWarnings(resp.warnings);
			}
		}
		this.cdr.detectChanges();
	}

	private processReceivedWarnings(warnings: any) {
		if (warnings && warnings.not_found && warnings.not_found.length > 0) {
			warnings.not_found.forEach((nf: string) => {
				this.addedUsers = this.addedUsers.filter(e => e !== nf);
			});
			this.error = true;
			this.success = false;
			this.removeErrorSuccessFromDomInFuture();
		} else {
			this.success = true;
			this.error = false;
			this.removeErrorSuccessFromDomInFuture();
		}
	}

	private removeErrorSuccessFromDomInFuture() {
		clearTimeout(this.removeErrorSuccessTimeout);
		this.removeErrorSuccessTimeout = setTimeout(() => {
			this.error = false;
			this.success = false;
			this.cdr.detectChanges();
		}, 5000);
	}

	public getLinkFromShareAddress(shareId: string): string {
		return environment.domain + '/share/' + shareId;
	}

	public cancel() {
		this.requestClose.emit();
	}

}
