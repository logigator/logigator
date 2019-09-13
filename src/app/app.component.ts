import {Component, ElementRef, NgZone, OnInit, Renderer2, ViewChild} from '@angular/core';
import {ThemingService} from './services/theming/theming.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

	@ViewChild('appRoot', {static: true})
	private appRoot: ElementRef<HTMLDivElement>;

	constructor(private renderer2: Renderer2, private ngZone: NgZone, private theming: ThemingService) {}

	ngOnInit(): void {
		this.ngZone.runOutsideAngular(() => {
			this.renderer2.listen('document', 'contextmenu', (e: MouseEvent) => {
				e.preventDefault();
			});
		});

		this.renderer2.addClass(this.appRoot.nativeElement, this.theming.themeClass);
	}

}
