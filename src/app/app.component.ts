import {Component, OnInit, Renderer2} from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

	constructor(private renderer2: Renderer2) {}

	ngOnInit(): void {
		this.renderer2.listen('document', 'contextmenu', (e: MouseEvent) => {
			e.preventDefault();
		});
	}


}
