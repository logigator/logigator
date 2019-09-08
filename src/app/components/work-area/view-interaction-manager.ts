import {View} from './view';
import {Grid} from './grid';
import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {ElementSprite} from '../../models/element-sprite';

export class ViewInteractionManager {

	private _view: View;

	private _moveStartPos: PIXI.Point;
	private _lastMousePos: PIXI.Point;
	private _currentlyDraggingMultiple = false;
	private _drawingSelectRect = false;
	private _selectRect: PIXI.Graphics;

	constructor(view: View) {
		this._view = view;
		this._selectRect = new PIXI.Graphics();

		this.addEventListenersToView();
		this.addEventListenersToSelectRect();
	}

	private addEventListenersToView() {
		this._view.on('click', (e: InteractionEvent) => this.handleMouseClickOnView(e));
		this._view.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnView(e));
		this._view.on('pointerup', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		this._view.on('pointerupoutside', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		this._view.on('pointermove', (e: InteractionEvent) => this.handlePointerMoveOnView(e));
	}

	private addEventListenersToSelectRect() {
		this._selectRect.interactive = true;
		this._selectRect.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnSelectRect(e));
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
			if (e.target === this._view) {

				if (this._moveStartPos) {
					this.resetSelectionToOldPosition();
				}
				delete this._moveStartPos;
				this.clearSelection();
				this._drawingSelectRect = true;
				this._view.removeChild(this._selectRect);
				this._selectRect.position = e.data.getLocalPosition(this._view);
				this._selectRect.width = 0;
				this._selectRect.height = 0;
				this._selectRect.clear();
				this._selectRect.beginFill(0, 0.3);
				this._selectRect.drawRect(0, 0, 1, 1);
			}
		}
	}


	private handlePointerUpOnView(e: InteractionEvent) {
		if (this._view.workModeService.currentWorkMode === 'select') {
			if (this._drawingSelectRect) {
				this._drawingSelectRect = false;
				const selectStart = Grid.getGridPosForPixelPos(this._selectRect.position);
				const selectEnd = Grid.getGridPosForPixelPos(new PIXI.Point(
					this._selectRect.position.x + this._selectRect.width,
					this._selectRect.position.y + this._selectRect.height)
				);
				this.selectInRect(selectStart, selectEnd);
				if (this._view.selectionService.selectedIds().length === 0) {
					this._view.removeChild(this._selectRect);
				}
			} else if (this._currentlyDraggingMultiple) {
				this._currentlyDraggingMultiple = false;

				const movedDif = Grid.getGridPosForPixelPos(
					new PIXI.Point(this._lastMousePos.x - this._moveStartPos.x, this._lastMousePos.y - this._moveStartPos.y)
				);

				//TODO: tell project Service
				const movePossible = false;

				if (movePossible) {
					this._view.removeChild(this._selectRect);
					this.clearSelection();
					delete this._moveStartPos;
				}
			}
		}
	}

	private handlePointerMoveOnView(e: InteractionEvent) {
		if (this._view.workModeService.currentWorkMode === 'select') {
			if (this._drawingSelectRect) {
				if (!this._selectRect.parent) {
					this._view.addChild(this._selectRect);
				}
				const rectEndPos = e.data.getLocalPosition(this._view);
				this._selectRect.width = rectEndPos.x - this._selectRect.x;
				this._selectRect.height = rectEndPos.y -= this._selectRect.y;
			} else if (this._currentlyDraggingMultiple) {
				const currentMousePos = e.data.getLocalPosition(this._view);
				const dx = currentMousePos.x - this._lastMousePos.x;
				const dy = currentMousePos.y - this._lastMousePos.y;

				this._selectRect.position.x += dx;
				this._selectRect.position.y += dy;
				this.applyDraggingPositionChangeToSelection(dx, dy);

				this._lastMousePos = currentMousePos;
			}
		}
	}

	private handlePointerDownOnSelectRect(e: InteractionEvent) {
		if (this._view.workModeService.currentWorkMode === 'select') {
			this._currentlyDraggingMultiple = true;
			this._lastMousePos = e.data.getLocalPosition(this._view);
			if (!this._moveStartPos) {
				this._moveStartPos = this._lastMousePos;
			}
		}
	}


	private handleMouseClickElement(e: InteractionEvent, elem: ElementSprite) {
		if (this._view.workModeService.currentWorkMode === 'select') {
			this.selectSingleComp(elem);
		}
	}

	private applyDraggingPositionChangeToSelection(dx: number, dy: number) {
		this._view.selectionService.selectedIds().forEach(id => {
			const sprite = this._view.allElements.get(id).sprite;
			sprite.position.x += dx;
			sprite.position.y += dy;
		});
	}

	private resetSelectionToOldPosition() {
		this._view.selectionService.selectedIds().forEach(id => {
			const elemSprite = this._view.allElements.get(id);
			elemSprite.sprite.position = Grid.getLocalChunkPixelPosForGridPos(elemSprite.element.pos);
		});
	}

	private clearSelection() {
		this._view.selectionService.selectedIds().forEach(id => {
			this._view.allElements.get(id).sprite.tint = 0xffffff;
		});
		this._view.selectionService.clearSelection();
	}

	private selectInRect(start: PIXI.Point, end: PIXI.Point) {
		this.clearSelection();
		const selected = this._view.selectionService.selectFromRect(this._view.projectsService.currProject , start, end);
		selected.forEach(id => {
			this._view.allElements.get(id).sprite.tint = 0x8a8a8a;
		});
	}

	private selectSingleComp(elem: ElementSprite) {
		this.clearSelection();
		elem.sprite.tint = 0x8a8a8a;
		this._view.selectionService.selectComponent(elem.element.id);
	}
}
