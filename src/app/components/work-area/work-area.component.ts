import {Component, ElementRef, NgZone, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import * as PIXI from 'pixi.js';
import {View} from '../../models/rendering/view';
import {ProjectsService} from '../../services/projects/projects.service';
import {Project} from '../../models/project';
import {WorkArea} from '../../models/rendering/work-area';

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

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private projectsService: ProjectsService
	) {
		super();
	}

	ngOnInit() {
		this._allViews = new Map<number, View>();

		this.ngZone.runOutsideAngular(async () => {
			await this.loadPixiFont();
			this.preventContextMenu(this._pixiCanvasContainer, this.renderer2);
			this.initPixi(this._pixiCanvasContainer, this.renderer2);
			this.initPixiTicker(() => {
				this.activeView.updateZoomPan();
				this._pixiRenderer.render(this.activeView);
			});

			this.projectsService.onProjectOpened$.subscribe(projectId => {
				this.ngZone.runOutsideAngular(() => {
					this.openProject(projectId);
					this._pixiTicker.start(); // start ticker after a project was opened
				});
			});
		});
	}

	private loadPixiFont(): Promise<void> {
		return new Promise<void>(resolve => {
			const loader = PIXI.Loader.shared;
			loader.add('luis_george_cafe', '/assets/fonts/louis_george_cafe_bitmap/font.fnt')
				.load(() => resolve());
		});
	}

	public get allProjects(): Map<number, Project> {
		return this.projectsService.allProjects;
	}

	private openProject(projectId: number) {
		const newView = new View(projectId, this._pixiCanvasContainer.nativeElement);
		this.ngZone.run(() => {
			this._allViews.set(projectId, newView);
			this.activeView = newView;
		});
	}

	public switchActiveView(toSwitchToId: number) {
		this.projectsService.switchToProject(toSwitchToId);
		this.activeView = this._allViews.get(toSwitchToId);
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
