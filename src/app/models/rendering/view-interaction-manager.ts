import {View} from './view';
import {Grid} from './grid';
import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {ElementSprite} from '../element-sprite';
import {Element} from '../element';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {SelectionService} from '../../services/selection/selection.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {CollisionFunctions} from '../collision-functions';
import {merge, Subscription} from 'rxjs';
import {ThemingService} from '../../services/theming/theming.service';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {CompSpriteGenerator} from './comp-sprite-generator';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter} from 'rxjs/operators';
import {CopyService} from '../../services/copy/copy.service';

export class ViewInteractionManager {

	private readonly _view: View;

	private _workModeSubscription: Subscription;
	private _pasteSubscription: Subscription;

	private _actionStartPos: PIXI.Point;
	private _lastMousePos: PIXI.Point;

	private _newCompSprite: PIXI.DisplayObject;
	private _draggingNewComp = false;

	private _newWireDir: 'hor' | 'ver';
	private _drawingNewWire = false;
	private readonly _newWire: PIXI.Graphics;

	private _singleSelectedElement: Element;
	private _currentlyDragging = false;
	private _drawingSelectRect = false;
	private readonly _selectRect: PIXI.Graphics;

	constructor(view: View) {
		this._view = view;
		this._selectRect = new PIXI.Graphics();
		this._newWire = new PIXI.Graphics();

		this.addEventListenersToView();
		this.addEventListenersToSelectRect();

		this._workModeSubscription = merge(
			WorkModeService.staticInstance.currentWorkMode$,
			ProjectInteractionService.staticInstance.onElementsDelete$,
			ProjectInteractionService.staticInstance.onPaste$
		).subscribe(_ => this.cleanUp());

		this._pasteSubscription = ProjectInteractionService.staticInstance.onPaste$.pipe(
			filter(_ => this._view.projectId === ProjectsService.staticInstance.currProject.id)
		).subscribe(_ => this.onPaste());
	}

	private addEventListenersToView() {
		this._view.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnView(e));
		this._view.on('pointerup', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		this._view.on('pointerupoutside', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		this._view.on('pointermove', (e: InteractionEvent) => this.handlePointerMoveOnView(e));
	}

	private addEventListenersToSelectRect() {
		this._selectRect.interactive = true;
		this._selectRect.zIndex = 10;
		this._selectRect.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnSelectRect(e));
	}

	public addEventListenersToNewElement(elemSprite: ElementSprite) {
		elemSprite.sprite.interactive = true;
		elemSprite.sprite.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnElement(e, elemSprite));
	}

	private handlePointerDownOnView(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select' && e.data.button === 0) {
			this.addSelectRectOrResetSelection(e);
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildWire' && e.data.button === 0) {
			this.startDrawingNewWire(e);
		} else if (WorkModeService.staticInstance.currentWorkMode === 'connectWire' && e.data.button === 0) {
			this.connectOrDisconnectWires(e);
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildComponent'
			&& WorkModeService.staticInstance.currentComponentToBuild !== 0
			&& e.data.button === 0
		) {
			this.startDraggingNewComponent(e);
		}
	}

	private handlePointerUpOnView(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select' && e.data.button === 0) {
			this.selectOrApplyMove();
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildWire' && e.data.button === 0) {
			this.addWire(e);
		} else if (this._draggingNewComp) {
			this.placeNewComp();
		}
	}

	private handlePointerMoveOnView(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select') {
			this.drawSelectRectOrMove(e);
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildWire') {
			this.drawNewWire(e);
		} else if (this._draggingNewComp) {
			this.dragNewComp(e);
		}
	}

	private handlePointerDownOnSelectRect(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select') {
			this.startDragging(e);
		}
	}

	private handlePointerDownOnElement(e: InteractionEvent, elem: ElementSprite) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select') {
			if (this._singleSelectedElement === elem.element) {
				this.startDragging(e);
			} else {
				this.selectSingleComp(elem);
			}
		}
	}

	private startDrawingNewWire(e: PIXI.interaction.InteractionEvent) {
		this._drawingNewWire = true;
		this._actionStartPos = Grid.getPixelPosForPixelPosOnGridWire(e.data.getLocalPosition(this._view));
		this._newWire.position = this._actionStartPos;
		this._view.addChild(this._newWire);
	}

	private addSelectRectOrResetSelection(e: PIXI.interaction.InteractionEvent) {
		if (e.target === this._view) {
			if (this._actionStartPos) {
				this.resetSelectionToOldPosition();
			}
			delete this._actionStartPos;
			if (SelectionService.staticInstance.selectedIds().length > 0) {
				SelectionService.staticInstance.selectedIds().forEach(id => {
					const element = this._view.allElements.get(id);
					this._view.addToCorrectChunk(element.sprite, element.element.pos);
					this._view.setLocalChunkPos(element.element, element.sprite);
				});
			}
			this.clearSelection();
			this._drawingSelectRect = true;
			this._view.removeChild(this._selectRect);
			this._selectRect.position = e.data.getLocalPosition(this._view);
			this._selectRect.width = 0;
			this._selectRect.height = 0;
			this._selectRect.clear();
			this._selectRect.beginFill(ThemingService.staticInstance.getEditorColor('selectRect'), 0.3);
			this._selectRect.drawRect(0, 0, 1, 1);
		}
	}

	private selectOrApplyMove() {
		if (this._drawingSelectRect) {
			this._drawingSelectRect = false;
			const selectStart = Grid.getGridPosForPixelPos(this._selectRect.position);
			const selectEnd = Grid.getGridPosForPixelPos(new PIXI.Point(
				this._selectRect.position.x + this._selectRect.width,
				this._selectRect.position.y + this._selectRect.height)
			);
			this.selectInRect(selectStart, selectEnd);
			if (SelectionService.staticInstance.selectedIds().length === 0) {
				this._view.removeChild(this._selectRect);
			}
		} else if (this._currentlyDragging) {
			this._currentlyDragging = false;

			let endPos;
			if (this._singleSelectedElement) {
				endPos = Grid.getGridPosForPixelPos(this._lastMousePos);
			} else {
				endPos = Grid.getGridPosForPixelPos(this._selectRect.position);
			}
			const movedDif = new PIXI.Point(endPos.x - this._actionStartPos.x, endPos.y - this._actionStartPos.y);
			if (ProjectsService.staticInstance.currProject.moveElementsById(
				SelectionService.staticInstance.selectedIds(), movedDif)
			) {
				this._view.removeChild(this._selectRect);
				this.clearSelection();
				delete this._singleSelectedElement;
				delete this._actionStartPos;
			}
		}
	}

	private connectOrDisconnectWires(e: InteractionEvent) {
		const pos = Grid.getGridPosForPixelPos(e.data.getLocalPosition(this._view));
		ProjectsService.staticInstance.currProject.toggleWireConnection(pos);
	}

	private addWire(e: InteractionEvent) {
		this._drawingNewWire = false;
		if (!this._actionStartPos) return;
		const wire1StartPos = Grid.getGridPosForPixelPos(this._actionStartPos);
		let wire2EndPos = Grid.getGridPosForPixelPos(e.data.getLocalPosition(this._view));
		let wire1End2StartPos;
		switch (this._newWireDir) {
			case 'hor':
				wire1End2StartPos = new PIXI.Point(wire2EndPos.x, wire1StartPos.y);
				break;
			case 'ver':
				wire1End2StartPos = new PIXI.Point(wire1StartPos.x, wire2EndPos.y);
				break;
			default:
				return;
		}
		if (!(wire1End2StartPos.x !== wire2EndPos.x || wire1End2StartPos.y !== wire2EndPos.y)) {
			wire2EndPos = undefined;
		}
		this._view.placeWires(wire1StartPos, wire1End2StartPos, wire2EndPos);

		this._newWire.clear();
		this._view.removeChild(this._newWire);
		delete this._newWireDir;
	}

	private drawNewWire(e: InteractionEvent) {
		if (this._drawingNewWire) {
			const currentMousePos = Grid.getPixelPosForPixelPosOnGridWire(e.data.getLocalPosition(this._view));
			const endPos = new PIXI.Point(currentMousePos.x - this._actionStartPos.x, currentMousePos.y - this._actionStartPos.y);
			this.setDirForNewWire(currentMousePos);
			this._newWire.clear();
			this._newWire.lineStyle(1 / this._view.zoomPan.currentScale, ThemingService.staticInstance.getEditorColor('wire'));
			this._newWire.moveTo(0, 0);
			switch (this._newWireDir) {
				case 'hor':
					this._newWire.lineTo(endPos.x, 0);
					this._newWire.lineTo(endPos.x, endPos.y);
					break;
				case 'ver':
					this._newWire.lineTo(0, endPos.y);
					this._newWire.lineTo(endPos.x, endPos.y);
					break;
			}
		}
	}

	private drawSelectRectOrMove(e: InteractionEvent) {
		if (this._drawingSelectRect) {
			if (!this._selectRect.parent) {
				this._view.addChild(this._selectRect);
			}
			const rectEndPos = e.data.getLocalPosition(this._view);
			this._selectRect.width = rectEndPos.x - this._selectRect.x;
			this._selectRect.height = rectEndPos.y -= this._selectRect.y;
		} else if (this._currentlyDragging) {
			const currentMousePos = Grid.getPixelPosOnGridForPixelPos(e.data.getLocalPosition(this._view));
			const dx = currentMousePos.x - this._lastMousePos.x;
			const dy = currentMousePos.y - this._lastMousePos.y;

			if (dx !== 0 || dy !== 0) {
				this._selectRect.position.x += dx;
				this._selectRect.position.y += dy;
				this.applyDraggingPositionChangeToSelection(dx, dy);

				this._lastMousePos = currentMousePos;
			}
		}
	}

	private setDirForNewWire(currentMousePos) {
		if (!this._newWireDir && CollisionFunctions.distance(this._actionStartPos, currentMousePos) >= 1) {
			if (this._actionStartPos.x === currentMousePos.x) {
				this._newWireDir = 'ver';
			} else if (this._actionStartPos.y === currentMousePos.y) {
				this._newWireDir = 'hor';
			} else {

				this._newWireDir = 'ver';
			}
		}
	}

	private startDraggingNewComponent(e: InteractionEvent) {
		this._draggingNewComp = true;
		const typeId = WorkModeService.staticInstance.currentComponentToBuild;
		const elemType = ElementProviderService.staticInstance.getElementById(typeId);
		this._newCompSprite = CompSpriteGenerator.getComponentSprite(
			elemType.symbol,
			elemType.numInputs,
			elemType.rotation,
			this._view.zoomPan.currentScale
		);
		this._newCompSprite.position = Grid.getPixelPosOnGridForPixelPos(e.data.getLocalPosition(this._view));
		this._view.addChild(this._newCompSprite);
	}

	private dragNewComp(e: InteractionEvent) {
		this._newCompSprite.position = Grid.getPixelPosOnGridForPixelPos(e.data.getLocalPosition(this._view));
	}

	private placeNewComp() {
		if (this._newCompSprite.position.x > 0 && this._newCompSprite.position.y > 0) {
			this._view.placeComponent(
				Grid.getGridPosForPixelPos(this._newCompSprite.position),
				WorkModeService.staticInstance.currentComponentToBuild
			);
		}
		this._view.removeChild(this._newCompSprite);
		this._newCompSprite.destroy();
		this._draggingNewComp = false;
	}

	private applyDraggingPositionChangeToSelection(dx: number, dy: number) {
		SelectionService.staticInstance.selectedIds().forEach(id => {
			const sprite = this._view.allElements.get(id).sprite;
			sprite.position.x += dx;
			sprite.position.y += dy;
		});
		SelectionService.staticInstance.selectedConnections().forEach(point => {
			const sprite = this._view.connectionPoints.get(`${point.x}:${point.y}`);
			sprite.position.x += dx;
			sprite.position.y += dy;
		});
	}

	private resetSelectionToOldPosition() {
		SelectionService.staticInstance.selectedIds(this._view.projectId).forEach(id => {
			if (!this._view.allElements.has(id)) return;
			const elemSprite = this._view.allElements.get(id);
			this._view.removeChild(elemSprite.sprite);

			this._view.addToCorrectChunk(elemSprite.sprite, elemSprite.element.pos);
			this._view.setLocalChunkPos(elemSprite.element, elemSprite.sprite);
		});
		SelectionService.staticInstance.selectedConnections(this._view.projectId).forEach(point => {
			const key = `${point.x}:${point.y}`;
			if (!this._view.connectionPoints.has(key)) return;
			const sprite = this._view.connectionPoints.get(key);
			this._view.removeChild(sprite);

			this._view.addToCorrectChunk(sprite, point);

			const pos = Grid.getLocalChunkPixelPosForGridPosWireStart(point);
			const size = this._view.calcConnPointSize();
			sprite.position = this._view.adjustConnPointPosToSize(pos, size);
		});
	}

	private startDragging(e: InteractionEvent) {
		this._currentlyDragging = true;
		this._lastMousePos = Grid.getPixelPosOnGridForPixelPos(e.data.getLocalPosition(this._view));
		if (!this._actionStartPos) {
			if (this._singleSelectedElement) {
				this._actionStartPos = Grid.getGridPosForPixelPos(this._lastMousePos);
			} else {
				this._actionStartPos = Grid.getGridPosForPixelPos(this._selectRect.position);
			}
		}
	}

	private clearSelection() {
		SelectionService.staticInstance.selectedIds(this._view.projectId).forEach(id => {
			if (this._view.allElements.has(id))
				this._view.allElements.get(id).sprite.tint = 0xffffff;
		});
		SelectionService.staticInstance.selectedConnections(this._view.projectId).forEach(point => {
			const key = `${point.x}:${point.y}`;
			if (this._view.connectionPoints.has(key))
				this._view.connectionPoints.get(key).tint = 0xffffff;
		});
		SelectionService.staticInstance.clearSelection(this._view.projectId);
		delete this._singleSelectedElement;
	}

	private selectInRect(start: PIXI.Point, end: PIXI.Point) {
		if (start.x === end.x && start.y === end.y) return;
		this.clearSelection();
		const selected = SelectionService.staticInstance.selectFromRect(ProjectsService.staticInstance.currProject, start, end);
		selected.forEach(id => {
			const element = this._view.allElements.get(id);
			element.sprite.tint = 0x8a8a8a;

			element.sprite.parent.removeChild(element.sprite);
			this._view.addChild(element.sprite);

			if (element.element.typeId === 0) {
				element.sprite.position = Grid.getPixelPosForGridPosWire(element.element.pos);
			} else {
				element.sprite.position = Grid.getPixelPosForGridPos(element.element.pos);
			}
		});
		SelectionService.staticInstance.selectedConnections().forEach(point => {
			const element = this._view.connectionPoints.get(`${point.x}:${point.y}`);
			element.tint = 0x8a8a8a;
			element.parent.removeChild(element);
			this._view.addChild(element);
			const pos = Grid.getPixelPosForGridPosWire(point);
			const size = this._view.calcConnPointSize();
			element.position = this._view.adjustConnPointPosToSize(pos, size);
		});
	}

	private onPaste() {
		console.log(CopyService.staticInstance.getCopiedElementsBoundingBox());
		console.log(CopyService.staticInstance.copiedElements);
	}

	private selectSingleComp(elem: ElementSprite) {
		this.resetSelectionToOldPosition();
		this.clearSelection();
		this._singleSelectedElement = elem.element;
		delete this._actionStartPos;
		this._view.removeChild(this._selectRect);
		elem.sprite.tint = 0x8a8a8a;
		elem.sprite.parent.removeChild(elem.sprite);
		elem.sprite.position = Grid.getPixelPosForGridPos(elem.element.pos);
		this._view.addChild(elem.sprite);
		SelectionService.staticInstance.selectComponent(elem.element.id);
	}

	private cleanUp() {
		this.resetSelectionToOldPosition();
		this.clearSelection();
		delete this._actionStartPos;
		delete this._newWireDir;
		delete this._lastMousePos;
		this._drawingSelectRect = false;
		this._drawingSelectRect = false;
		this._currentlyDragging = false;
		this._view.removeChild(this._selectRect);
		this._view.removeChild(this._newWire);
	}

	public destroy() {
		this._workModeSubscription.unsubscribe();
	}
}
