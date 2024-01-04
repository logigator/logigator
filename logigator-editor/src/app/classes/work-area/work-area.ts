// @ts-strict-ignore
import * as PIXI from 'pixi.js';
import { fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	Directive,
	ElementRef,
	Renderer2
} from '@angular/core';
import { ThemingService } from '../../services/theming/theming.service';
import { RenderTicker } from '../../services/render-ticker/render-ticker.service';
import { getStaticDI } from '../../utils/get-di';
import { PixiLoaderService } from '../../services/pixi-loader/pixi-loader.service';
import { View } from '../view/view';
import { Point } from 'pixi.js';

@Directive()
export abstract class WorkArea {
	protected _pixiRenderer: PIXI.Renderer;

	protected _view: View = new View();

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
			antialias: false,
			powerPreference: 'high-performance',
			backgroundColor: getStaticDI(ThemingService).getEditorColor('background'),
			resolution: window.devicePixelRatio || 1,
			autoDensity: true
		});

		renderer2.appendChild(
			canvasContainer.nativeElement,
			this._pixiRenderer.view
		);

		fromEvent(window, 'wheel')
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => {
				console.log('1');
				this._view.scale = new Point(this._view.scale.x * 1.1, this._view.scale.y * 1.1);
				this.ticker.singleFrame(this.getIdentifier());
			});

		fromEvent(window, 'resize')
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => {
				this._pixiRenderer.resize(
					canvasContainer.nativeElement.offsetWidth,
					canvasContainer.nativeElement.offsetHeight
				);
				this.ticker.singleFrame(this.getIdentifier());
			});
	}

	protected addTickerFunction() {
		this.ticker.addTickerFunction(this.getIdentifier(), () => {
			this._pixiRenderer.render(this._view);
		});
	}

	protected preventContextMenu(
		canvasContainer: ElementRef<HTMLDivElement>,
		renderer2: Renderer2
	) {
		renderer2.listen(
			canvasContainer.nativeElement,
			'contextmenu',
			(e: MouseEvent) => {
				e.preventDefault();
			}
		);
	}

	protected destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
		this.ticker.removeTickerFunction(this.getIdentifier());
	}
}
