import 'pixi.js/math-extras';

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	Injector,
	signal,
	inject
} from '@angular/core';
import { Location } from '@angular/common';
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
import { WorkModeService } from './work-mode/work-mode.service';
import { PersistenceService } from './persistence/persistence.service';
import { CardModule } from 'primeng/card';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
	selector: 'app-root',
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
	private readonly injector = inject(Injector);
	private readonly routerService = inject(RouterService);
	private readonly persistenceService = inject(PersistenceService);
	protected readonly projectService = inject(ProjectService);
	private readonly workModeService = inject(WorkModeService);
	private readonly location = inject(Location);

	protected readonly cursorPosition = signal<Point>(new Point(0, 0));

	protected readonly componentSettings = computed(() => {
		return this.workModeService.selectedComponentConfig();
	});

	constructor() {
		setStaticDIInjector(this.injector);

		if (!this.routerService.matches(this.location.path())) {
			this.persistenceService.createAndSetEmptyProject();
		}

		void this.routerService.processCurrentRoute();
	}
}
