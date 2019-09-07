import {Component, DoCheck, NgZone, OnChanges, OnInit, Renderer2} from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, DoCheck {

	constructor(private renderer2: Renderer2, private ngZone: NgZone) {}

	ngOnInit(): void {
		this.ngZone.runOutsideAngular(() => {
			this.renderer2.listen('document', 'contextmenu', (e: MouseEvent) => {
				e.preventDefault();
			});
		});
	}

	ngDoCheck(): void {
		console.log('check');
	}


}
