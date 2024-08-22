import 'pixi.js/math-extras';

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	Injector,
	signal
} from '@angular/core';
import { Point } from 'pixi.js';
import { RouterService } from './routing/router.service';
import { TitleBarComponent } from './ui/title-bar/title-bar.component';
import { ToolBarComponent } from './ui/tool-bar/tool-bar.component';
import { SideBarComponent } from './ui/side-bar/side-bar.component';
import { StatusBarComponent } from './ui/status-bar/status-bar.component';
import { BoardComponent } from './ui/board/board.component';
import { setStaticDIInjector } from './utils/get-di';
import { ComponentSettingsComponent } from './ui/component-settings/component-settings.component';
import { ProjectService } from './project/project.service';
import { Project } from './project/project';
import { WorkModeService } from './work-mode/work-mode.service';
import { CardModule } from 'primeng/card';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [
		TitleBarComponent,
		ToolBarComponent,
		SideBarComponent,
		StatusBarComponent,
		BoardComponent,
		ComponentSettingsComponent,
		CardModule,
		TranslocoDirective
	],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
	protected readonly boardPosition = signal<Point>(new Point(0, 0));

	protected readonly componentSettings = computed(() => {
		return this.workModeService.selectedComponentConfig();
	});

	constructor(
		private readonly injector: Injector,
		private readonly routerService: RouterService,
		protected readonly projectService: ProjectService,
		private readonly workModeService: WorkModeService
	) {
		setStaticDIInjector(this.injector);
		this.routerService.processCurrentRoute();

		this.projectService.setMainProject(new Project());
	}
}
