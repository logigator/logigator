import {ChangeDetectionStrategy, Component, EventEmitter, OnInit, Output} from '@angular/core';
import {EditorInteractionService} from '../../../services/editor-interaction/editor-interaction.service';

@Component({
	selector: 'app-edit-dropdown',
	templateUrl: './edit-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './edit-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor(private editorInteractionService: EditorInteractionService) { }

	ngOnInit() {
	}

	public checkActionUsable(action: string) {
		// return checkActionUsable(action);
		// TODO: fix
	}

	public close() {
		this.requestClosed.emit();
	}

	public undo() {
		this.editorInteractionService.undoForCurrent();
		this.close();
	}

	public redo() {
		this.editorInteractionService.redoForCurrent();
		this.close();
	}

	public copy() {
		this.editorInteractionService.copySelection();
		this.close();
	}

	public paste() {
		this.editorInteractionService.paste();
		this.close();
	}

	public cut() {
		this.editorInteractionService.cutSelection();
		this.close();
	}

	public delete() {
		this.editorInteractionService.deleteSelection();
		this.close();
	}
}
