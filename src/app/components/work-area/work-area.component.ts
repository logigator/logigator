import {Component, ElementRef, NgZone, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import * as PIXI from 'pixi.js';
import {View} from './view';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {Grid} from './grid';
import {ProjectsService} from '../../services/projects/projects.service';
import {Project} from '../../models/project';
import {ThemingService} from '../../services/theming/theming.service';

@Component({
	selector: 'app-work-area',
	templateUrl: './work-area.component.html',
	styleUrls: ['./work-area.component.scss']
})
export class WorkAreaComponent implements OnInit, OnDestroy {

	private _allViews: Map<number, View>;

	private _pixiRenderer: PIXI.Renderer;
	private _pixiWindowRenderer: PIXI.Renderer;

	private _pixiTicker: PIXI.Ticker;
	private _pixiWindowTicker: PIXI.Ticker;

	public activeView: View;
	public activeWindowView: View;

	private _destroy = new Subject<any>();

	@ViewChild('pixiCanvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	@ViewChild('pixiWindowCanvasContainer', {static: true})
	private _pixiWindowCanvasContainer: ElementRef<HTMLDivElement>;

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private projectsService: ProjectsService,
		private theming: ThemingService
	) { }

	ngOnInit() {
		this._allViews = new Map<number, View>();

		this.ngZone.runOutsideAngular(async () => {
			await this.loadPixiFont();
			this.initPixi();
			this.initPixiTicker();

			this.renderer2.listen(this._pixiCanvasContainer.nativeElement, 'contextmenu', (e: MouseEvent) => {
				e.preventDefault();
			});
			this.renderer2.listen(this._pixiWindowCanvasContainer.nativeElement, 'contextmenu', (e: MouseEvent) => {
				e.preventDefault();
			});

			this.projectsService.onProjectOpened$.subscribe(projectId => {
				this.ngZone.runOutsideAngular(() => {
					this.openProject(projectId);
					this._pixiTicker.start(); // start ticker after a project was opened

					this.activeWindowView = new View(projectId, this._pixiWindowCanvasContainer.nativeElement);
					this.activeWindowView.interactive = false;
					this._pixiWindowTicker.start();
				});
			});
		});
	}

	private initPixi() {
		this._pixiRenderer = new PIXI.Renderer({
			height: this._pixiCanvasContainer.nativeElement.offsetHeight,
			width: this._pixiCanvasContainer.nativeElement.offsetWidth,
			antialias: false,
			powerPreference: 'high-performance',
			backgroundColor: this.theming.getEditorColor('background'),
			resolution: Math.ceil(window.devicePixelRatio || 1),
			autoDensity: true
		});

		this._pixiWindowRenderer = new PIXI.Renderer({
			height: this._pixiWindowCanvasContainer.nativeElement.offsetHeight,
			width: this._pixiWindowCanvasContainer.nativeElement.offsetWidth,
			antialias: false,
			powerPreference: 'high-performance',
			backgroundColor: this.theming.getEditorColor('background'),
			resolution: Math.ceil(window.devicePixelRatio || 1),
			autoDensity: true
		});

		this.renderer2.appendChild(this._pixiCanvasContainer.nativeElement, this._pixiRenderer.view);
		this.renderer2.appendChild(this._pixiWindowCanvasContainer.nativeElement, this._pixiWindowRenderer.view);

		fromEvent(window, 'resize').pipe(
			takeUntil(this._destroy)
		).subscribe(() => {
			this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
			this._pixiWindowRenderer.resize(this._pixiWindowCanvasContainer.nativeElement.offsetWidth, this._pixiWindowCanvasContainer.nativeElement.offsetHeight);
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

	private initPixiTicker() {
		this._pixiTicker = new PIXI.Ticker();
		this._pixiTicker.add(() => {
				this.activeView.updateZoomPan();
				this._pixiRenderer.render(this.activeView);
		});

		this._pixiWindowTicker = new PIXI.Ticker();
		this._pixiWindowTicker.add(() => {
			this.activeWindowView.updateZoomPan();
			this._pixiWindowRenderer.render(this.activeWindowView);
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
		this._destroy.next();
		this._destroy.unsubscribe();
	}

}
