import * as PIXI from 'pixi.js';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {ElementRef, Renderer2} from '@angular/core';
import {ThemingService} from '../../services/theming/theming.service';

export abstract class WorkArea {

	protected _pixiRenderer: PIXI.Renderer;

	protected _pixiTicker: PIXI.Ticker;

	protected _destroySubject = new Subject<any>();

	protected initPixi(canvasContainer: ElementRef<HTMLDivElement>, renderer2: Renderer2) {
		this._pixiRenderer = new PIXI.Renderer({
			height: canvasContainer.nativeElement.offsetHeight,
			width: canvasContainer.nativeElement.offsetWidth,
			antialias: false,
			powerPreference: 'high-performance',
			backgroundColor: ThemingService.staticInstance.getEditorColor('background'),
			resolution: Math.ceil(window.devicePixelRatio || 1),
			autoDensity: true
		});

		renderer2.appendChild(canvasContainer.nativeElement, this._pixiRenderer.view);

		fromEvent(window, 'resize').pipe(
			takeUntil(this._destroySubject)
		).subscribe(() => {
			this._pixiRenderer.resize(canvasContainer.nativeElement.offsetWidth, canvasContainer.nativeElement.offsetHeight);
		});
	}

	protected preventContextMenu(canvasContainer: ElementRef<HTMLDivElement>, renderer2: Renderer2) {
		renderer2.listen(canvasContainer.nativeElement, 'contextmenu', (e: MouseEvent) => {
			e.preventDefault();
		});
	}

	protected initPixiTicker(tickFunction: () => void) {
		this._pixiTicker = new PIXI.Ticker();
		this._pixiTicker.add(tickFunction);
	}

	protected destroy() {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}
}
