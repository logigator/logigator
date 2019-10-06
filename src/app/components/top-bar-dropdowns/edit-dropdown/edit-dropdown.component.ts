import {ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {ProjectInteractionService} from '../../../services/project-interaction/project-interaction.service';

@Component({
	selector: 'app-edit-dropdown',
	templateUrl: './edit-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './edit-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(private projectInteraction: ProjectInteractionService) { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public undo() {
		this.projectInteraction.undoForCurrent();
		this.close();
	}

	public redo() {
		this.projectInteraction.redoForCurrent();
		this.close();
	}

	public copy() {
		this.projectInteraction.copySelection();
		this.close();
	}

	public paste() {
		this.projectInteraction.paste();
		this.close();
	}

	public cut() {
		this.projectInteraction.cutSelection();
		this.close();
	}

	public delete() {
		this.projectInteraction.deleteSelection();
		this.close();
	}
}
