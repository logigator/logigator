import {View} from './view';
import {Grid} from './grid';
import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {ElementSprite} from '../../models/element-sprite';

export class ViewInteractionManager {

	private _view: View;

	private _drawingSelectRect = false;
	private _selectRect: PIXI.Graphics;

	constructor(view: View) {
		this._view = view;
		this._selectRect = new PIXI.Graphics();

		this.addEventListenersToView();
	}

	private addEventListenersToView() {
		this._view.on('click', (e: InteractionEvent) => this.handleMouseClickOnView(e));
		this._view.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnView(e));
		this._view.on('pointerup', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		this._view.on('pointerupoutside', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		this._view.on('pointermove', (e: InteractionEvent) => this.handlePointerMoveOnView(e));
	}

	public addEventListenersToNewElement(elemSprite: ElementSprite) {
		elemSprite.sprite.interactive = true;
		elemSprite.sprite.on('click', (e: InteractionEvent) => this.handleMouseClickElement(e, elemSprite));
	}

	private handleMouseClickOnView(e: InteractionEvent) {
		if (this._view.workModeService.currentWorkMode === 'buildComponent') {
			this._view.placeComponent(
				Grid.getGridPosForPixelPos(e.data.getLocalPosition(this._view)),
				this._view.workModeService.currentComponentToBuild
			);
		}
	}

	private handlePointerDownOnView(e: InteractionEvent) {
		if (this._view.workModeService.currentWorkMode === 'select' && e.data.button === 0) {
			this._drawingSelectRect = true;
			this._selectRect.position = e.data.getLocalPosition(this._view);
			this._selectRect.width = 0;
			this._selectRect.height = 0;
			this._selectRect.beginFill(0, 0.3);
			this._selectRect.drawRect(0, 0, 1, 1);
			this._view.addChild(this._selectRect);
		}
	}

	private handlePointerUpOnView(e: InteractionEvent) {
		if (this._drawingSelectRect) {
			this._drawingSelectRect = false;

			this._view.selectionService.selectFromRect(
				this._view.projectsService.allProjects.get(this._view.projectId),
				Grid.getGridPosForPixelPos(this._selectRect.position),
				Grid.getGridPosForPixelPos(new PIXI.Point(
					this._selectRect.position.x + this._selectRect.width,
					this._selectRect.position.y + this._selectRect.height)
				)
			);
			// TODO: mark as selected

			this._selectRect.clear();
			this._view.removeChild(this._selectRect);
		}
	}

	private handlePointerMoveOnView(e: InteractionEvent) {
		if (this._drawingSelectRect) {
			const rectSize = e.data.getLocalPosition(this._view);
			rectSize.x -= this._selectRect.x;
			rectSize.y -= this._selectRect.y;
			this._selectRect.width = rectSize.x;
			this._selectRect.height = rectSize.y;
		}
	}

	private handleMouseClickElement(e: InteractionEvent, elem: ElementSprite) {
		if (this._view.workModeService.currentWorkMode === 'select') {
			this._view.selectionService.selectComponent(elem.element.id);
			// TODO: mark as selected
		} else {
			e.stopPropagation();
		}
	}
}
