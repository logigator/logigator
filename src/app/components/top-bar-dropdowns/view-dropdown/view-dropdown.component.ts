import {Component, EventEmitter, OnInit, Output} from '@angular/core';

@Component({
	selector: 'app-view-dropdown',
	templateUrl: './view-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './view-dropdown.component.scss']
})
export class ViewDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor() { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public zoomIn() {
		this.close();
	}

	public zoomOut() {
		this.close();
	}
}
