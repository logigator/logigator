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

	private pixiRenderer: PIXI.Renderer;

	private pixiTicker: PIXI.Ticker;

	private activeView: View;

	private allViews: View[];

	private destroy = new Subject<any>();

	@ViewChild('pixiCanvasContainer', {static: true})
	private pixiCanvasContainer: ElementRef<HTMLDivElement>;

	constructor(private renderer2: Renderer2, private ngZone: NgZone) { }

	ngOnInit() {
		this.allViews = [];
		this.initPixi();
		this.initPixiTicker();
		this.initEmptyView();
	}

	private initPixi() {
		this.pixiRenderer = new PIXI.Renderer({
			height: this.pixiCanvasContainer.nativeElement.offsetHeight,
			width: this.pixiCanvasContainer.nativeElement.offsetWidth,
			antialias: true,
			backgroundColor: 0xffffff,
			resolution: window.devicePixelRatio || 1
		});
		this.renderer2.appendChild(this.pixiCanvasContainer.nativeElement, this.pixiRenderer.view);

		fromEvent(window, 'resize').pipe(
			takeUntil(this.destroy)
		).subscribe(() => {
			this.pixiRenderer.resize(this.pixiCanvasContainer.nativeElement.offsetWidth, this.pixiCanvasContainer.nativeElement.offsetHeight);
		});
	}

	private initEmptyView() {
		const emptyView = View.createEmptyView(0, this.pixiCanvasContainer.nativeElement);
		this.allViews.push(emptyView);
		this.activeView = emptyView;
	}

	private initPixiTicker() {
		this.ngZone.runOutsideAngular(() => {
			this.pixiTicker = new PIXI.Ticker();
			this.pixiTicker.add(() => {
				this.pixiRenderer.render(this.activeView);
			});
			this.pixiTicker.start();
		});
	}

	ngOnDestroy(): void {
		this.destroy.next();
		this.destroy.unsubscribe();
	}

}
