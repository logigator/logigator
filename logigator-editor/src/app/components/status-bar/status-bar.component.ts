import {Component} from '@angular/core';
import {SelectionService} from '../../services/selection/selection.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {fromEvent, Observable, Subscription} from 'rxjs';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {LoadingService} from '../../services/loading/loading.service';
import {tap} from 'rxjs/operators';
import {ThemingService} from '../../services/theming/theming.service';

@Component({
	selector: 'app-status-bar',
	templateUrl: './status-bar.component.html',
	styleUrls: ['./status-bar.component.scss']
})
export class StatusBarComponent {

	public showingAllTasks = false;

	private closeTasksSubscription: Subscription;

	constructor(
		private selectionService: SelectionService,
		private projectsService: ProjectsService,
		private workMode: WorkModeService,
		private loadingService: LoadingService,
		private themingService: ThemingService
	) {}

	public get selected(): number {
		return this.selectionService.selectedIds().length;
	}

	public get isSaved(): boolean {
		if (!this.projectsService.currProject) return true;
		return !this.projectsService.currProject.saveDirty;
	}

	public get workModeDescription$(): Observable<string> {
		return this.workMode.workModeDescription$;
	}

	public get currTheme(): string {
		return this.themingService.currentTheme;
	}

	public get tasks$(): Observable<string[]> {
		return this.loadingService.tasks$.pipe(
			tap(tasks => {
				if (tasks.length <= 1) this.closeAllTasks();
			})
		);
	}

	public loadingClick(event: MouseEvent, tasks: string[]) {
		if (tasks.length <= 1) return;

		this.showingAllTasks = true;
		event.stopPropagation();
		this.addCloseTasksListener();
	}

	private addCloseTasksListener() {
		if (!this.closeTasksSubscription) {
			this.closeTasksSubscription = fromEvent(window, 'mousedown').subscribe(() => this.closeAllTasks());
		}
	}

	private closeAllTasks() {
		this.showingAllTasks = false;
		this.closeTasksSubscription?.unsubscribe();
		delete this.closeTasksSubscription;
	}
}


