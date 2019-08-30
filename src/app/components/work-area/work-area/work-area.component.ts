import {Component, ElementRef, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import * as PIXI from 'pixi.js';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

@Component({
	selector: 'app-work-area',
	templateUrl: './work-area.component.html',
	styleUrls: ['./work-area.component.scss']
})
export class WorkAreaComponent implements OnInit, OnDestroy {

	private destroy: Subject<any> = new Subject<any>();

	private pixiRenderer: PIXI.Renderer;
	private mainStage: PIXI.Container;

	private pixiTicker: PIXI.Ticker;

	@ViewChild('pixiCanvasContainer', {static: true})
	private pixiCanvasContainer: ElementRef<HTMLDivElement>;

	constructor(private renderer2: Renderer2) { }

	ngOnInit() {
		this.initPixi();
		this.initPixiTicker();
	}

	private initPixi() {
		this.pixiRenderer = new PIXI.Renderer({
			height: this.pixiCanvasContainer.nativeElement.offsetHeight,
			width: this.pixiCanvasContainer.nativeElement.offsetWidth,
			antialias: true,
			resolution: window.devicePixelRatio || 1
		});
		this.renderer2.appendChild(this.pixiCanvasContainer.nativeElement, this.pixiRenderer.view);
		this.mainStage = new PIXI.Container();

		fromEvent(window, 'resize').pipe(
			takeUntil(this.destroy)
		).subscribe(_ => {
			this.pixiRenderer.resize(this.pixiCanvasContainer.nativeElement.offsetWidth, this.pixiCanvasContainer.nativeElement.offsetHeight);
		});
	}

	private initPixiTicker() {
		this.pixiTicker = new PIXI.Ticker();
		this.pixiTicker.add(() => {
			this.pixiRenderer.render(this.mainStage);
		});
		this.pixiTicker.start();

		// TODO: subscribe to active tab and pause/start the ticker (rendering)
	}

	ngOnDestroy(): void {
		this.destroy.next();
		this.destroy.unsubscribe();
	}

}
