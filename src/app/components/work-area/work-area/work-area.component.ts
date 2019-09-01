import {Component, ElementRef, NgZone, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import * as PIXI from 'pixi.js';
import {View} from './view';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

@Component({
	selector: 'app-work-area',
	templateUrl: './work-area.component.html',
	styleUrls: ['./work-area.component.scss']
})
export class WorkAreaComponent implements OnInit, OnDestroy {

	private _pixiRenderer: PIXI.Renderer;

	private _pixiTicker: PIXI.Ticker;

	private _activeView: View;

	private _allViews: View[];

	private _destroy = new Subject<any>();

	@ViewChild('pixiCanvasContainer', {static: true})
	private _pixiCanvasContainer: ElementRef<HTMLDivElement>;

	constructor(private renderer2: Renderer2, private ngZone: NgZone) { }

	ngOnInit() {
		this._allViews = [];
		this.initPixi();
		this.initPixiTicker();
		this.initEmptyView();
	}

	private initPixi() {
		this._pixiRenderer = new PIXI.Renderer({
			height: this._pixiCanvasContainer.nativeElement.offsetHeight,
			width: this._pixiCanvasContainer.nativeElement.offsetWidth,
			antialias: true,
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

	private initEmptyView() {
		const emptyView = View.createEmptyView(0, this._pixiCanvasContainer.nativeElement);
		this._allViews.push(emptyView);
		this._activeView = emptyView;
	}

	private initPixiTicker() {
		this.ngZone.runOutsideAngular(() => {
			this._pixiTicker = new PIXI.Ticker();
			this._pixiTicker.add(() => {
				this._activeView.updateZoomPan();
				this._pixiRenderer.render(this._activeView);
			});
			this._pixiTicker.start();
		});
	}

	ngOnDestroy(): void {
		this._destroy.next();
		this._destroy.unsubscribe();
	}

}
