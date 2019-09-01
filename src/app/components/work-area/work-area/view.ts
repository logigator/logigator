import * as PIXI from 'pixi.js';
import {InputManager} from './input-manager';
import {ZoomPan} from './zoom-pan';

export class View extends PIXI.Container {

	private _projectId: number;

	private _view: PIXI.Container;
	private _zoomContainer: PIXI.Container;

	private _zoomPan: ZoomPan = new ZoomPan();

	private _inputManager: InputManager;

	private _htmlContainer: HTMLElement;

	constructor(projectId: number, htmlContainer: HTMLElement) {
		super();
		this._projectId = projectId;
		this._htmlContainer = htmlContainer;
		this.interactive = true;

		this._zoomContainer = new PIXI.Container();
		this._view = new PIXI.Container();

		this._zoomContainer.addChild(this._view);
		this.addChild(this._zoomContainer);

		this._inputManager = new InputManager(this._htmlContainer);

		let rect = new PIXI.Graphics();
		rect.beginFill(0xff0000);
		rect.drawRect(250, 200, 150, 150);
		this._view.addChild(rect);
	}

	public static createEmptyView(projectId: number, htmlContainer: HTMLElement): View {
		return new View(projectId, htmlContainer);
	}

	public updateZoomPan() {
		if (this._inputManager.isDragging) {
			this._zoomPan.translateBy(this._inputManager.mouseDX, this._inputManager.mouseDY);
			this._inputManager.clearMouseDelta();
			this._applyZoomPan();
		} else {

		}
	}

	private _applyZoomPan() {
		const t = this._zoomPan.Transform;

		this._view.transform.localTransform.set(t.a, t.b, t.c, t.d, t.tx, t.ty);
		this._zoomContainer.transform.updateTransform(this._view.transform);
	}

	public destroy() {
		this._inputManager.destroy();
		super.destroy({
			children: true
		});
	}

}
