// @ts-strict-ignore
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UserService } from '../../../services/user/user.service';
import {
	UntypedFormBuilder,
	UntypedFormGroup,
	Validators
} from '@angular/forms';
import { PopupContentComp } from '../../popup/popup-content-comp';

@Component({
	selector: 'app-save-as',
	templateUrl: './save-as.component.html',
	styleUrls: ['./save-as.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaveAsComponent
	extends PopupContentComp<
		never,
		{
			name: string;
			description: string;
			target: 'local' | 'server';
			public: boolean;
		}
	>
	implements OnInit
{
	public saveForm: UntypedFormGroup;

	constructor(
		private user: UserService,
		private formBuilder: UntypedFormBuilder
	) {
		super();
	}

	ngOnInit() {
		this.saveForm = this.formBuilder.group({
			name: [
				'',
				[
					Validators.required,
					Validators.minLength(2),
					Validators.maxLength(20),
					Validators.pattern('^.+$')
				]
			],
			description: ['', [Validators.maxLength(1000)]],
			public: [true]
		});
	}

	public get isLoggedIn(): boolean {
		return this.user.isLoggedIn;
	}

	public async saveToServer() {
		this.requestClose.emit({
			target: 'server',
			...this.saveForm.value
		});
	}

	public exportProject() {
		this.requestClose.emit({
			target: 'local',
			...this.saveForm.value
		});
	}
}
