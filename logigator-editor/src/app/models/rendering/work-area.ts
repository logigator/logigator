// @ts-strict-ignore
import * as PIXI from 'pixi.js';
import { fromEvent, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
	Directive,
	ElementRef,
	EventEmitter,
	Output,
	Renderer2
} from '@angular/core';
import { ThemingService } from '../../services/theming/theming.service';
import { ZoomPanInputManager } from './zoom-pan-input-manager';
import { View } from './view';
import { EditorView } from './editor-view';
import { ReqInspectElementEvent } from './req-inspect-element-event';
import { getStaticDI } from '../get-di';
import { RenderTicker } from '../../services/render-ticker/render-ticker.service';
import { EditorAction } from '../editor-action';
import { PixiLoaderService } from '../../services/pixi-loader/pixi-loader.service';

@Directive()
export abstract class WorkArea {
	protected _pixiRenderer: PIXI.Renderer;

	protected _zoomPanInputManager: ZoomPanInputManager;

	protected _destroySubject = new Subject<void>();

	protected _activeView: View;

	protected ticker: RenderTicker = getStaticDI(RenderTicker);

	@Output()
	requestInspectElementInSim = new EventEmitter<ReqInspectElementEvent>();

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
			resolution: Math.ceil(window.devicePixelRatio || 1),
			autoDensity: true
		});
		this._pixiRenderer.plugins.interaction.moveWhenInside = true;

		renderer2.appendChild(
			canvasContainer.nativeElement,
			this._pixiRenderer.view
		);

		fromEvent(window, 'resize')
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => {
				this._pixiRenderer.resize(
					canvasContainer.nativeElement.offsetWidth,
					canvasContainer.nativeElement.offsetHeight
				);
				if (this._activeView) this._activeView.updateChunks();
				this.ticker.singleFrame(this.getIdentifier());
			});
	}

	protected addTickerFunction() {
		this.ticker.addTickerFunction(this.getIdentifier(), () => {
			if (!this._activeView) return;
			this.updateZoomPan();
			this._pixiRenderer.render(this._activeView);
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

	protected initZoomPan(canvasContainer: ElementRef<HTMLDivElement>) {
		this._zoomPanInputManager = new ZoomPanInputManager(
			canvasContainer.nativeElement
		);
		this._zoomPanInputManager.interactionStart$
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => {
				this.ticker.startTicker(this.getIdentifier());
				if (this._activeView) this._activeView.interactiveChildren = false;
			});
		this._zoomPanInputManager.interactionEnd$
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => {
				this.ticker.stopTicker(this.getIdentifier());
				if (this._activeView) this._activeView.interactiveChildren = true;
			});
		this._zoomPanInputManager.zoom$
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => {
				this.ticker.singleFrame(this.getIdentifier());
			});
	}

	private updateZoomPan() {
		let needsChunkUpdate = false;
		if (this._zoomPanInputManager.isDragging) {
			this._activeView.zoomPan.translateBy(
				this._zoomPanInputManager.mouseDX,
				this._zoomPanInputManager.mouseDY
			);
			this._zoomPanInputManager.clearMouseDelta();
			needsChunkUpdate = true;
		}

		if (
			this._zoomPanInputManager.isZoomIn &&
			this._activeView.applyZoom(
				EditorAction.ZOOM_IN,
				this._zoomPanInputManager.mouseX,
				this._zoomPanInputManager.mouseY
			)
		) {
			needsChunkUpdate = true;
			this.updateSelectedZoomScale();
		} else if (
			this._zoomPanInputManager.isZoomOut &&
			this._activeView.applyZoom(
				EditorAction.ZOOM_OUT,
				this._zoomPanInputManager.mouseX,
				this._zoomPanInputManager.mouseY
			)
		) {
			needsChunkUpdate = true;
			this.updateSelectedZoomScale();
		}

		if (needsChunkUpdate) {
			this._activeView.updateChunks();
		}
	}

	private updateSelectedZoomScale() {
		if ('updateSelectedElementsScale' in this._activeView)
			(this._activeView as EditorView).updateSelectedElementsScale();
	}

	protected destroy() {
		this._zoomPanInputManager.destroy();
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
		this.ticker.removeTickerFunction(this.getIdentifier());
		if (this._activeView) {
			this._activeView.destroy();
		}
	}
}
