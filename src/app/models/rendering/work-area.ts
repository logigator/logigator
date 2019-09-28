import * as PIXI from 'pixi.js';
import {fromEvent, Subject} from 'rxjs';
import {takeUntil} from 'rxjs/operators';
import {ElementRef, Renderer2} from '@angular/core';
import {ThemingService} from '../../services/theming/theming.service';
import {RenderTicker} from './render-ticker';
import {ZoomPanInputManager} from './zoom-pan-input-manager';
import {View} from './view';

export abstract class WorkArea {

	private static _loadedPixiFont = false;

	public static pixiFontLoaded$ = new Subject<void>();

	protected _pixiRenderer: PIXI.Renderer;

	protected _ticker = new RenderTicker();

	protected _zoomPanInputManager: ZoomPanInputManager;

	protected _destroySubject = new Subject<any>();

	protected initPixi(canvasContainer: ElementRef<HTMLDivElement>, renderer2: Renderer2) {
		this.loadPixiFont();
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
			this._ticker.singleFrame();
		});
	}

	protected preventContextMenu(canvasContainer: ElementRef<HTMLDivElement>, renderer2: Renderer2) {
		renderer2.listen(canvasContainer.nativeElement, 'contextmenu', (e: MouseEvent) => {
			e.preventDefault();
		});
	}

	private loadPixiFont() {
		if (WorkArea._loadedPixiFont === true) return;
		WorkArea._loadedPixiFont = true;
		const loader = PIXI.Loader.shared;
		loader.add('luis_george_cafe', '/assets/fonts/louis_george_cafe_bitmap/font.fnt')
			.load(() => WorkArea.pixiFontLoaded$.next());
	}

	protected initZoomPan(canvasContainer: ElementRef<HTMLDivElement>) {
		this._zoomPanInputManager = new ZoomPanInputManager(canvasContainer.nativeElement);
		this._zoomPanInputManager.interactionStart$.pipe(takeUntil(this._destroySubject)).subscribe(() => this._ticker.start());
		this._zoomPanInputManager.interactionEnd$.pipe(takeUntil(this._destroySubject)).subscribe(() => this._ticker.stop());
	}

	public updateZoomPan(view: View) {
		let needsChunkUpdate = false;
		if (this._zoomPanInputManager.isDragging) {
			view.zoomPan.translateBy(this._zoomPanInputManager.mouseDX, this._zoomPanInputManager.mouseDY);
			this._zoomPanInputManager.clearMouseDelta();
			needsChunkUpdate = true;
		}

		if (this._zoomPanInputManager.isZoomIn) {
			needsChunkUpdate = view.applyZoom('out', this._zoomPanInputManager.mouseX, this._zoomPanInputManager.mouseY) || needsChunkUpdate;
		} else if (this._zoomPanInputManager.isZoomOut) {
			needsChunkUpdate = view.applyZoom('in', this._zoomPanInputManager.mouseX, this._zoomPanInputManager.mouseY) || needsChunkUpdate;
		}

		if (needsChunkUpdate) {
			view.updateChunks();
		}
	}

	protected destroy() {
		this._zoomPanInputManager.destroy();
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}
}
