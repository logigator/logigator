import {Component, EventEmitter, OnInit, Output} from '@angular/core';

@Component({
	selector: 'app-help-dropdown',
	templateUrl: './help-dropdown.component.html',
	styleUrls: ['../top-bar-dropdowns.scss', './help-dropdown.component.scss']
})
export class HelpDropdownComponent implements OnInit {

	@Output()
	public requestClosed: EventEmitter<any> = new EventEmitter();

	constructor() { }

	ngOnInit() {
	}

	public close() {
		this.requestClosed.emit();
	}

	public help() {
		window.alert('UwU');
		this.close();
	}
}
