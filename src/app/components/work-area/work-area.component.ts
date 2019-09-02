import {Component, ElementRef, NgZone, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import * as PIXI from 'pixi.js';
import {View} from './view';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {Grid} from './grid';

@Component({
	selector: 'app-work-area',
	templateUrl: './work-area.component.html',
	styleUrls: ['./work-area.component.scss']
})
export class WorkAreaComponent implements OnInit, OnDestroy {

	private _pixiRenderer: PIXI.Renderer;

	private _pixiTicker: PIXI.Ticker;

	public activeView: View;

	public allViews: View[];

	private _destroy = new Subject<any>();

	@ViewChild('pixiCanvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	constructor(private renderer2: Renderer2, private ngZone: NgZone) { }

	ngOnInit() {
		this.allViews = [];

		this.ngZone.runOutsideAngular(() => {
			this.initPixi();
			this.initGridGeneration();
			this.initPixiTicker();
			this.initEmptyView();
		});
	}

	private initPixi() {
		this._pixiRenderer = new PIXI.Renderer({
			height: this._pixiCanvasContainer.nativeElement.offsetHeight,
			width: this._pixiCanvasContainer.nativeElement.offsetWidth,
			antialias: false,
			powerPreference: 'high-performance',
			backgroundColor: 0xffffff,
			resolution: window.devicePixelRatio || 1
		});
		this.renderer2.appendChild(this._pixiCanvasContainer.nativeElement, this._pixiRenderer.view);

		fromEvent(window, 'resize').pipe(
			takeUntil(this._destroy)
		).subscribe(() => {
			this._pixiRenderer.resize(this._pixiCanvasContainer.nativeElement.offsetWidth, this._pixiCanvasContainer.nativeElement.offsetHeight);
		});
	}

	private initGridGeneration() {
		Grid.setRenderer(this._pixiRenderer);
		Grid.setChunkSize(50);
		Grid.generateGridTexture();
	}

	private initEmptyView() {
		const emptyView = View.createEmptyView(0, this._pixiCanvasContainer.nativeElement);
		this.allViews.push(View.createEmptyView(1, this._pixiCanvasContainer.nativeElement));
		this.allViews.push(emptyView);
		this.activeView = emptyView;
	}

	private initPixiTicker() {
		this._pixiTicker = new PIXI.Ticker();
		this._pixiTicker.add(() => {
				this.activeView.updateZoomPan();
				this._pixiRenderer.render(this.activeView);
		});
		this._pixiTicker.start();
	}

	public switchActiveView(toSwitchToId: number) {
		const newActiveIndex = this.allViews.findIndex(view => view.projectId === toSwitchToId);
		this.activeView = this.allViews[newActiveIndex];
	}

	public closeView(id: number) {
		// TODO: ask if the user wants to save
		if (this.allViews.length <= 1) return;

		const toClose = this.allViews[this.allViews.findIndex(view => view.projectId === id)];
		this.allViews = this.allViews.filter(view => view.projectId !== toClose.projectId);

		if (toClose === this.activeView) {
			this.activeView = this.allViews[0];
		}

		toClose.destroy();

	}

	ngOnDestroy(): void {
		this._destroy.next();
		this._destroy.unsubscribe();
	}

}
