import { ChangeDetectionStrategy, Component, isDevMode } from '@angular/core';
import { RouterService } from './routing/router.service';
import { TitleBarComponent } from './ui/title-bar/title-bar.component';
import { ToolBarComponent } from './ui/tool-bar/tool-bar.component';
import { SideBarComponent } from './ui/side-bar/side-bar.component';
import { StatusBarComponent } from './ui/status-bar/status-bar.component';
import { LoggingService } from './logging/logging.service';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [
		TitleBarComponent,
		ToolBarComponent,
		SideBarComponent,
		StatusBarComponent
	],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
	constructor(
		private readonly routerService: RouterService,
		private readonly loggingService: LoggingService
	) {
		if (isDevMode()) {
			this.loggingService.warn('Application running in development mode', 'App');
		}

		this.routerService.processCurrentRoute();
	}
}
