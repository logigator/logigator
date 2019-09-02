import * as PIXI from 'pixi.js';
import {ZoomPanInputManager} from './zoom-pan-input-manager';
import {ZoomPan} from './zoom-pan';
import {Grid} from './grid';
import InteractionEvent = PIXI.interaction.InteractionEvent;

export class View extends PIXI.Container {

	private _projectId: number;

	private _zoomPan: ZoomPan;

	private _zoomPanInputManager: ZoomPanInputManager;

	private _htmlContainer: HTMLElement;

	private _chunks: PIXI.ParticleContainer[][];

	constructor(projectId: number, htmlContainer: HTMLElement) {
		super();
		this._projectId = projectId;
		this._htmlContainer = htmlContainer;
		this.interactive = true;

		this._zoomPanInputManager = new ZoomPanInputManager(this._htmlContainer);
		this._zoomPan = new ZoomPan(this);

		this.addChild(Grid.generateGridSprite());
		this.updateChunks();

		this.addEventListeners();
	}

	public static createEmptyView(projectId: number, htmlContainer: HTMLElement): View {
		return new View(projectId, htmlContainer);
	}

	private updateChunks() {
		let currentlyOnScreen = this._zoomPan.isOnScreen(this._htmlContainer.offsetHeight, this._htmlContainer.offsetWidth);
		currentlyOnScreen = {
			start: Grid.getGridPosForPixelPos(currentlyOnScreen.start),
			end: Grid.getGridPosForPixelPos(currentlyOnScreen.end)
		};
		// TODO: show / hide chunks
	}

	public updateZoomPan() {
		if (this._zoomPanInputManager.isDragging) {
			this._zoomPan.translateBy(this._zoomPanInputManager.mouseDX, this._zoomPanInputManager.mouseDY);
			this.updateChunks();
			this._zoomPanInputManager.clearMouseDelta();
		}

		if (this._zoomPanInputManager.isZoomIn) {
			this._zoomPan.zoomBy(0.9, this._zoomPanInputManager.mouseX, this._zoomPanInputManager.mouseY);
		} else if (this._zoomPanInputManager.isZoomOut) {
			this._zoomPan.zoomBy(1.15, this._zoomPanInputManager.mouseX, this._zoomPanInputManager.mouseY);
		}
	}

	public addEventListeners() {
		this.on('click', (e: InteractionEvent) => {
			// console.log(Grid.getGridPosForPixelPos(e.data.getLocalPosition(this)));
		});
	}

	public get projectId(): number {
		return this._projectId;
	}

	public destroy() {
		this._zoomPanInputManager.destroy();
		super.destroy({
			children: true
		});
	}

}
