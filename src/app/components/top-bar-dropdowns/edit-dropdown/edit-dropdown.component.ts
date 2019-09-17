import {Component, EventEmitter, OnInit, Output} from '@angular/core';

@Component({
	selector: 'app-edit-dropdown',
	templateUrl: './edit-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './edit-dropdown.component.scss']
})
export class EditDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor() { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}
}
