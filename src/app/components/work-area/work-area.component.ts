import {Component, ElementRef, NgZone, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import {View} from '../../models/rendering/view';
import {ProjectsService} from '../../services/projects/projects.service';
import {Project} from '../../models/project';
import {WorkArea} from '../../models/rendering/work-area';
import {WindowWorkAreaComponent} from '../window-work-area/window-work-area.component';
import {distinctUntilChanged, map, takeUntil} from 'rxjs/operators';
import {WorkModeService} from '../../services/work-mode/work-mode.service';

@Component({
	selector: 'app-work-area',
	templateUrl: './work-area.component.html',
	styleUrls: ['./work-area.component.scss']
})
export class WorkAreaComponent extends WorkArea implements OnInit, OnDestroy {

	private _allViews: Map<number, View>;

	public activeView: View;

	@ViewChild('pixiCanvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	@ViewChild('pixiWindowContainer', {static: true})
	private _pixiWindowContainer: WindowWorkAreaComponent;

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private projectsService: ProjectsService,
		private workMode: WorkModeService
	) {
		super();
	}

	ngOnInit() {
		this._allViews = new Map<number, View>();

		this.ngZone.runOutsideAngular(async () => {
			this.preventContextMenu(this._pixiCanvasContainer, this.renderer2);
			this.initZoomPan(this._pixiCanvasContainer);
			this.initPixi(this._pixiCanvasContainer, this.renderer2);
			this._ticker.setTickerFunction(() => {
				this.updateZoomPan(this.activeView);
				this._pixiRenderer.render(this.activeView);
			});

			this.projectsService.onProjectOpened$.pipe(
				takeUntil(this._destroySubject)
			).subscribe(projectId => {
				this.ngZone.runOutsideAngular(() => {
					this.openProject(projectId);
					this._ticker.singleFrame();
				});
			});
		});

		this.workMode.currentWorkMode$.pipe(
			takeUntil(this._destroySubject),
			map((mode) => mode === 'simulation'),
			distinctUntilChanged()
		).subscribe(isSim => this.isSimulationModeChanged(isSim));
	}

	public get allProjects(): Map<number, Project> {
		return this.projectsService.allProjects;
	}

	public get isSimulationMode(): boolean {
		return this.workMode.currentWorkMode === 'simulation';
	}

	private isSimulationModeChanged(simulation: boolean) {
		if (simulation) {
			this.renderer2.setStyle(this._pixiCanvasContainer.nativeElement, 'width', '100%');
			this.projectsService.allProjects.forEach(proj => {
				if (proj.type === 'project') {
					this.switchActiveView(proj.id);
				}
			});
		} else {
			this.renderer2.removeStyle(this._pixiCanvasContainer.nativeElement, 'width');
		}
		if (this._pixiRenderer) {
			this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
		}
	}

	private openProject(projectId: number) {
		const newView = new View(projectId, this._pixiCanvasContainer.nativeElement, this._ticker);
		this.ngZone.run(() => {
			this._allViews.set(projectId, newView);
			this.activeView = newView;
			this.projectsService.switchToProject(projectId);
		});
	}

	public switchActiveView(toSwitchToId: number) {
		this.projectsService.switchToProject(toSwitchToId);
		this.activeView = this._allViews.get(toSwitchToId);

		// this._pixiWindowContainer.show();
	}

	public closeView(id: number, event: MouseEvent) {
		event.stopPropagation();

		// TODO: ask if the user wants to save
		if (this._allViews.size <= 1) return;

		const toClose = this._allViews.get(id);
		this._allViews.delete(id);

		if (toClose === this.activeView) {
			this.switchActiveView(this._allViews.values().next().value.projectId);
		}

		this.projectsService.closeProject(id);
		toClose.destroy();

	}

	ngOnDestroy(): void {
		super.destroy();
	}

}
