import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Output
} from '@angular/core';

@Component({
	selector: 'app-view-dropdown',
	templateUrl: './view-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './view-dropdown.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewDropdownComponent {
	@Output()
	public requestClosed: EventEmitter<void> = new EventEmitter();

	constructor() {}

	public close() {
		this.requestClosed.emit();
	}

	public zoomIn() {
		// this.editorInteractionService.zoomIn();
		this.close();
	}

	public zoomOut() {
		// this.editorInteractionService.zoomOut();
		this.close();
	}

	public zoom100() {
		// this.editorInteractionService.zoom100();
		this.close();
	}

	public fullscreen() {
		// this.editorInteractionService.fullscreen();
		this.close();
	}
}
