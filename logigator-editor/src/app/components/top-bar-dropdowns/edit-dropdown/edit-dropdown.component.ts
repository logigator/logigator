import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Output
} from '@angular/core';

@Component({
	selector: 'app-edit-dropdown',
	templateUrl: './edit-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './edit-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditDropdownComponent {
	@Output()
	public requestClosed: EventEmitter<unknown> = new EventEmitter();

	constructor(
	) {}

	public get istCustomComponent(): boolean {
		// return this.elemProv.isCustomElement(this.projects.currProject.id);
		return false;
	}

	public close() {
		this.requestClosed.emit();
	}

	public undo() {
		// this.editorInteractionService.undo();
		this.close();
	}

	public redo() {
		// this.editorInteractionService.redo();
		this.close();
	}

	public copy() {
		// this.editorInteractionService.copy();
		this.close();
	}

	public paste() {
		// this.editorInteractionService.paste();
		this.close();
	}

	public cut() {
		// this.editorInteractionService.cut();
		this.close();
	}

	public delete() {
		// this.editorInteractionService.delete();
		this.close();
	}

	public plugs() {
		// this.editorInteractionService.editCustomComponentPlugs();
		this.close();
	}
}
