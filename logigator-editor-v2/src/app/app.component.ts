import { ChangeDetectionStrategy, Component, Injector } from '@angular/core';
import { RouterService } from './routing/router.service';
import { TitleBarComponent } from './ui/title-bar/title-bar.component';
import { ToolBarComponent } from './ui/tool-bar/tool-bar.component';
import { SideBarComponent } from './ui/side-bar/side-bar.component';
import { StatusBarComponent } from './ui/status-bar/status-bar.component';
import { LoggingService } from './logging/logging.service';
import { BoardComponent } from './ui/board/board.component';
import { setStaticDIInjector } from './utils/get-di';

import 'pixi.js/math-extras';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [
		TitleBarComponent,
		ToolBarComponent,
		SideBarComponent,
		StatusBarComponent,
		BoardComponent
	],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
	constructor(
		private readonly injector: Injector,
		private readonly routerService: RouterService,
		private readonly loggingService: LoggingService
	) {
		setStaticDIInjector(this.injector);
		this.routerService.processCurrentRoute();
	}
}
