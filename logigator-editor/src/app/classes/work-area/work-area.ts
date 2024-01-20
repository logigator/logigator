import * as PIXI from 'pixi.js';
import { fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Directive, ElementRef, OnDestroy, Renderer2 } from '@angular/core';
import { ThemingService } from '../../services/theming/theming.service';
import { RenderTicker } from '../../services/render-ticker/render-ticker.service';
import { getStaticDI } from '../../utils/get-di';
import { PixiLoaderService } from '../../services/pixi-loader/pixi-loader.service';
import { Project } from '../project/project';
import {
	ViewInputManager,
	ZoomDirection
} from '../view-input-manager/view-input-manager';

@Directive()
export abstract class WorkArea implements OnDestroy {
	protected _pixiRenderer: PIXI.Renderer | null = null;

	protected _inputManager: ViewInputManager | null = null;

	protected _view: Project = new Project();

	protected _destroySubject = new Subject<void>();

	protected ticker: RenderTicker = getStaticDI(RenderTicker);

	abstract getIdentifier(): string;

	protected initPixi(
		canvasContainer: ElementRef<HTMLDivElement>,
		renderer2: Renderer2
	) {
		getStaticDI(PixiLoaderService).loadPixiFont();
		this._pixiRenderer = new PIXI.Renderer({
			height: canvasContainer.nativeElement.offsetHeight,
			width: canvasContainer.nativeElement.offsetWidth,
			antialias: true,
			powerPreference: 'high-performance',
			backgroundColor: getStaticDI(ThemingService).getEditorColor('background'),
			resolution: window.devicePixelRatio || 1,
			autoDensity: true
		});

		renderer2.appendChild(
			canvasContainer.nativeElement,
			this._pixiRenderer.view
		);

		this._view.resizeViewport(
			canvasContainer.nativeElement.offsetWidth,
			canvasContainer.nativeElement.offsetHeight
		);

		fromEvent(window, 'resize')
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => {
				this._pixiRenderer!.resize(
					canvasContainer.nativeElement.offsetWidth,
					canvasContainer.nativeElement.offsetHeight
				);
				this._view.resizeViewport(
					canvasContainer.nativeElement.offsetWidth,
					canvasContainer.nativeElement.offsetHeight
				);
				this.ticker.singleFrame(this.getIdentifier());
			});

		this.initZoomPan(canvasContainer);
	}

	protected addTickerFunction() {
		this.ticker.addTickerFunction(this.getIdentifier(), () => {
			this._pixiRenderer!.render(this._view);
		});
	}

	private initZoomPan(canvasContainer: ElementRef<HTMLDivElement>) {
		if (this._inputManager) return;

		this._inputManager = new ViewInputManager(
			canvasContainer.nativeElement,
			this._destroySubject
		);
		this._inputManager.zoom$
			.pipe(takeUntil(this._destroySubject))
			.subscribe((dir) => {
				dir === ZoomDirection.IN ? this._view.zoomIn() : this._view.zoomOut();
				this.ticker.singleFrame(this.getIdentifier());
			});
		this._inputManager.pan$
			.pipe(takeUntil(this._destroySubject))
			.subscribe((pt) => {
				this._view.pan(pt);
				this.ticker.singleFrame(this.getIdentifier());
			});
	}

	ngOnDestroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
		this.ticker.removeTickerFunction(this.getIdentifier());
	}
}
