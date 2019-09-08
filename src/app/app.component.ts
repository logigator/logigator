import {Component, NgZone, OnInit, Renderer2} from '@angular/core';
import {SelectionService} from './services/selection/selection.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

	constructor(private renderer2: Renderer2, private ngZone: NgZone, private selectionService: SelectionService) {}

	ngOnInit(): void {
		this.ngZone.runOutsideAngular(() => {
			this.renderer2.listen('document', 'contextmenu', (e: MouseEvent) => {
				e.preventDefault();
			});
		});
	}

}
