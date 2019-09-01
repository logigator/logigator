import * as PIXI from 'pixi.js';
import {InputManager} from './input-manager';
import {ZoomPan} from './zoom-pan';

export class View extends PIXI.Container {

	private _projectId: number;

	private _view: PIXI.Container;

	private _zoomPan: ZoomPan;

	private _inputManager: InputManager;

	private _htmlContainer: HTMLElement;

	private posRect = new PIXI.Graphics();

	constructor(projectId: number, htmlContainer: HTMLElement) {
		super();
		this._projectId = projectId;
		this._htmlContainer = htmlContainer;
		this.interactive = true;

		this._view = new PIXI.Container();
		this.addChild(this._view);

		this._inputManager = new InputManager(this._htmlContainer);
		this._zoomPan = new ZoomPan(this._view);

		this.posRect.beginFill(0);
		for (let i = 0; i < 100; i++) {
			for (let j = 0; j < 100; j++) {
				this.posRect.drawRect(i * 100, j * 100, 10, 10 );
			}
		}
		this._view.addChild(this.posRect);
	}

	public static createEmptyView(projectId: number, htmlContainer: HTMLElement): View {
		return new View(projectId, htmlContainer);
	}

	public updateZoomPan() {
		console.log(this._zoomPan.isOnScreen(this._htmlContainer.offsetHeight, this._htmlContainer.offsetWidth));
		if (this._inputManager.isDragging) {
			this._zoomPan.translateBy(this._inputManager.mouseDX, this._inputManager.mouseDY);
			this._inputManager.clearMouseDelta();
		}

		if (this._inputManager.isZoomIn) {
			this._zoomPan.zoomBy(0.9, this._inputManager.mouseX, this._inputManager.mouseY);
		} else if (this._inputManager.isZoomOut) {
			this._zoomPan.zoomBy(1.15, this._inputManager.mouseX, this._inputManager.mouseY);
		}
	}

	public destroy() {
		this._inputManager.destroy();
		super.destroy({
			children: true
		});
	}

}
