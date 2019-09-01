import * as PIXI from 'pixi.js';
import {InputManager} from './input-manager';

export class View extends PIXI.Container {

	private projectId: number;

	private view: PIXI.Container;
	private zoomContainer: PIXI.Container;

	private inputManager: InputManager;

	private htmlContainer: HTMLElement;

	constructor(projectId: number, htmlContainer: HTMLElement) {
		super();
		this.projectId = projectId;
		this.htmlContainer = htmlContainer;
		this.interactive = true;

		this.zoomContainer = new PIXI.Container();
		this.view = new PIXI.Container();

		this.zoomContainer.addChild(this.view);
		this.addChild(this.zoomContainer);

		this.inputManager = new InputManager(this.htmlContainer);
	}

	public static createEmptyView(projectId: number, htmlContainer: HTMLElement): View {
		return new View(projectId, htmlContainer);
	}

	public destroy() {
		this.inputManager.destroy();
		super.destroy({
			children: true
		});
	}

}
