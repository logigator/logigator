import { Component } from '@angular/core';
import { RouterService } from './routing/router.service';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss'
})
export class AppComponent {
	constructor(private readonly routerService: RouterService) {
		console.log('AppComponent created');
	}
}
