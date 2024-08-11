import { Component } from '@angular/core';
import { RouterService } from './routing/router.service';
import { TitleBarComponent } from './ui/title-bar/title-bar.component';
import { ToolBarComponent } from './ui/tool-bar/tool-bar.component';
import { SideBarComponent } from './ui/side-bar/side-bar.component';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [TitleBarComponent, ToolBarComponent, SideBarComponent],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss'
})
export class AppComponent {
	constructor(private readonly routerService: RouterService) {
		this.routerService.processCurrentRoute();
	}
}
