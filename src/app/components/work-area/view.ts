import * as PIXI from 'pixi.js';
import {InputManager} from './input-manager';
import {ZoomPan} from './zoom-pan';
import {Grid} from './grid';

export class View extends PIXI.Container {

	private _projectId: number;

	private _view: PIXI.Container;

	private _zoomPan: ZoomPan;

	private _inputManager: InputManager;

	private _htmlContainer: HTMLElement;

	private _chunks: PIXI.ParticleContainer[][];

	constructor(projectId: number, htmlContainer: HTMLElement) {
		super();
		this._projectId = projectId;
		this._htmlContainer = htmlContainer;
		this.interactive = true;

		this._view = new PIXI.Container();
		this.addChild(this._view);

		this._inputManager = new InputManager(this._htmlContainer);
		this._zoomPan = new ZoomPan(this._view);

		this.updateChunks();
	}

	public static createEmptyView(projectId: number, htmlContainer: HTMLElement): View {
		return new View(projectId, htmlContainer);
	}

	private updateChunks() {
		const currentlyOnScreen = this._zoomPan.isOnScreen(this._htmlContainer.offsetHeight, this._htmlContainer.offsetWidth);

		// TODO: show / hide chunks
	}

	public updateZoomPan() {
		if (this._inputManager.isDragging) {
			this._zoomPan.translateBy(this._inputManager.mouseDX, this._inputManager.mouseDY);
			this.updateChunks();
			this._inputManager.clearMouseDelta();
		}

		if (this._inputManager.isZoomIn) {
			this._zoomPan.zoomBy(0.9, this._inputManager.mouseX, this._inputManager.mouseY);
		} else if (this._inputManager.isZoomOut) {
			this._zoomPan.zoomBy(1.15, this._inputManager.mouseX, this._inputManager.mouseY);
		}
	}

	public get projectId(): number {
		return this._projectId;
	}

	public destroy() {
		this._inputManager.destroy();
		super.destroy({
			children: true
		});
	}

}
