import {ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ProjectSaveManagementService} from '../../../services/project-save-management/project-save-management.service';
import {checkActionUsable} from '../../../models/action-usable-in-modes';
import {ProjectInteractionService} from '../../../services/project-interaction/project-interaction.service';
import {InteractionAction} from '../../../models/interaction-action';

@Component({
	selector: 'app-file-dropdown',
	templateUrl: './file-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './file-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(
		private projectSaveService: ProjectSaveManagementService,
		private projectInteraction: ProjectInteractionService
	) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public checkActionUsable(action: InteractionAction) {
		return checkActionUsable(action);
	}

	public newProject() {
		this.close();
		this.projectInteraction.newProject();
	}

	public async newComponent() {
		await this.projectInteraction.newComponent();
		this.close();
	}

	public async openProject() {
		this.close();
		this.projectInteraction.openProject();
	}

	public saveProject() {
		this.projectInteraction.saveAll()
		this.close();
	}

	public async exportProject() {
		await this.projectInteraction.exportToFile();
		this.close();
	}

	public async shareProject() {
		await this.projectInteraction.shareProject();
		this.close();
	}

	public get canShare(): boolean {
		return this.projectSaveService.isFromServer;
	}

	public screenshot() {
		this.close();
	}
}
