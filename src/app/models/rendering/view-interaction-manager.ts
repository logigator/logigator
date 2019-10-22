import {EditorView} from './editor-view';
import {Grid} from './grid';
import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {ElementSprite} from '../element-sprite';
import {Element} from '../element';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {SelectionService} from '../../services/selection/selection.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {CollisionFunctions} from '../collision-functions';
import {merge, of, Subscription} from 'rxjs';
import {ThemingService} from '../../services/theming/theming.service';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {CompSpriteGenerator} from './comp-sprite-generator';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter} from 'rxjs/operators';
import {CopyService} from '../../services/copy/copy.service';
import {getStaticDI} from '../get-di';
import {NgZone} from '@angular/core';

export class ViewInteractionManager {

	private readonly _view: EditorView;

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
	private _currentlyPasting = false;
	private readonly _selectRect: PIXI.Graphics;

	public pastingElements: ElementSprite[] = [];
	public pastingConnPoints: PIXI.Graphics[] = [];

	constructor(view: EditorView) {
		this._view = view;
		this._selectRect = new PIXI.Graphics();
		this._selectRect.beginFill(ThemingService.staticInstance.getEditorColor('selectRect'), 0.3);
		this._selectRect.drawRect(0, 0, 1, 1);

		this._newWire = new PIXI.Graphics();

		this.addEventListenersToView();
		this.addEventListenersToSelectRect();

		this._workModeSubscription = merge(
			WorkModeService.staticInstance.currentWorkMode$,
			ProjectInteractionService.staticInstance.onElementsDelete$,
		).subscribe(_ => this.cleanUp());

		this._pasteSubscription = ProjectInteractionService.staticInstance.onPaste$.pipe(
			filter(_ => this._view.projectId === ProjectsService.staticInstance.currProject.id)
		).subscribe(_ => this.onPaste());
	}

	private addEventListenersToView() {
		getStaticDI(NgZone).runOutsideAngular(() => {
			this._view.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnView(e));
			this._view.on('pointerup', (e: InteractionEvent) => this.handlePointerUpOnView(e));
			this._view.on('pointerupoutside', (e: InteractionEvent) => this.handlePointerUpOnView(e));
		});
	}

	private addEventListenersToSelectRect() {
		getStaticDI(NgZone).runOutsideAngular(() => {
			this._selectRect.interactive = true;
			this._selectRect.zIndex = 10;
			this._selectRect.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnSelectRect(e));
		});
	}

	public addEventListenersToNewElement(elemSprite: ElementSprite) {
		getStaticDI(NgZone).runOutsideAngular(() => {
			elemSprite.sprite.interactive = true;
			elemSprite.sprite.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnElement(e, elemSprite));
		});
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
		this._view.ticker.singleFrame();
		this._view.on('pointermove', (e1: InteractionEvent) => this.handlePointerMoveOnView(e1));
	}

	private handlePointerUpOnView(e: InteractionEvent) {
		if ((WorkModeService.staticInstance.currentWorkMode === 'select' || this._currentlyPasting) && e.data.button === 0) {
			this.selectOrApplyMove();
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildWire' && e.data.button === 0) {
			this.addWire(e);
		} else if (this._draggingNewComp) {
			this.placeNewComp();
		}
		this._view.ticker.start();
		this._view.removeListener('pointermove');
	}

	private handlePointerMoveOnView(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select' || this._currentlyPasting) {
			this.drawSelectRectOrMove(e);
		} else if (WorkModeService.staticInstance.currentWorkMode === 'buildWire') {
			this.drawNewWire(e);
		} else if (this._draggingNewComp) {
			this.dragNewComp(e);
		}
		this._view.ticker.singleFrame();
	}

	private handlePointerDownOnSelectRect(e: InteractionEvent) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select' || this._currentlyPasting) {
			this.startDragging(e);
			this._view.ticker.singleFrame();
		}
	}

	private handlePointerDownOnElement(e: InteractionEvent, elem: ElementSprite) {
		if (WorkModeService.staticInstance.currentWorkMode === 'select' && e.data.button === 0) {
			if (this._singleSelectedElement === elem.element) {
				this.startDragging(e);
			} else {
				this.selectSingleComp(elem);
			}
			this._view.ticker.singleFrame();
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
			this.cancelPasting();
			this.resetSelectionToOldPosition();
			delete this._actionStartPos;
			this.clearSelection();
			this._drawingSelectRect = true;
			this._view.removeChild(this._selectRect);
			this._selectRect.position = e.data.getLocalPosition(this._view);
			this._selectRect.width = 0;
			this._selectRect.height = 0;
		}
	}

	private selectOrApplyMove() {
		if (this._drawingSelectRect) {
			this._drawingSelectRect = false;
			const selectStart = Grid.getFloatGridPosForPixelPos(this._selectRect.position);
			const selectEnd = Grid.getFloatGridPosForPixelPos(new PIXI.Point(
				this._selectRect.position.x + this._selectRect.width,
				this._selectRect.position.y + this._selectRect.height)
			);
			this.selectInRect(selectStart, selectEnd);
			if (SelectionService.staticInstance.selectedIds().length === 0) {
				this._view.removeChild(this._selectRect);
			}
		} else if (this._currentlyDragging) {
			this._currentlyDragging = false;
			if (this._currentlyPasting) {
				const elementsToPaste = this.pastingElements.map(es => es.element);
				const endPos = Grid.getGridPosForPixelPos(this.pastingElements[0].sprite.position);
				if (ProjectsService.staticInstance.currProject.addElements(
					elementsToPaste, new PIXI.Point(endPos.x - elementsToPaste[0].pos.x, endPos.y - elementsToPaste[0].pos.y))
				) {
					ProjectsService.staticInstance.inputsOutputsCustomComponentChanged(this._view.projectId);
					this._view.removeChild(this._selectRect);
					this.cancelPasting();
					delete this._singleSelectedElement;
					delete this._actionStartPos;
				}
			} else {
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
		const typeId = WorkModeService.staticInstance.currentComponentToBuild;
		const elemType = ElementProviderService.staticInstance.getElementById(typeId);
		if (elemType.numInputs === 0 && elemType.numOutputs === 0) return;
		this._draggingNewComp = true;
		this._newCompSprite = CompSpriteGenerator.getComponentSprite(
			elemType.symbol,
			elemType.numInputs,
			elemType.numOutputs,
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
			const typeIdToBuild = WorkModeService.staticInstance.currentComponentToBuild;
			this._view.placeComponent(
				Grid.getGridPosForPixelPos(this._newCompSprite.position),
				typeIdToBuild
			);
			if (ElementProviderService.staticInstance.isPlugElement(typeIdToBuild)) {
				ProjectsService.staticInstance.inputsOutputsCustomComponentChanged(this._view.projectId);
			}
		}
		this._view.removeChild(this._newCompSprite);
		this._newCompSprite.destroy();
		this._draggingNewComp = false;
	}

	private applyDraggingPositionChangeToSelection(dx: number, dy: number) {
		if (this._currentlyPasting) {
			for (let i = 0; i < this.pastingElements.length; i++) {
				this.pastingElements[i].sprite.position.x += dx;
				this.pastingElements[i].sprite.position.y += dy;
			}
			for (let i = 0; i < this.pastingConnPoints.length; i++) {
				this.pastingConnPoints[i].position.x += dx;
				this.pastingConnPoints[i].position.y += dy;
			}
			return;
		}
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
			element.sprite.tint = ThemingService.staticInstance.getEditorColor('selectTint');

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
			element.tint = ThemingService.staticInstance.getEditorColor('selectTint');
			element.parent.removeChild(element);
			this._view.addChild(element);
			const pos = Grid.getPixelPosForGridPosWire(point);
			const size = this._view.calcConnPointSize();
			element.position = this._view.adjustConnPointPosToSize(pos, size);
		});
	}

	private onPaste() {
		if (this._currentlyPasting || CopyService.staticInstance.copiedElements.length === 0) return;
		this.cleanUp();
		this._currentlyPasting = true;
		const copiedElements = CopyService.staticInstance.copiedElements;
		const copiedConnPts = CopyService.staticInstance.copiedConPoints;
		const bounding = CopyService.staticInstance.getCopiedElementsBoundingBox();
		const pasteRectPos = this.calcPasteRectPos();
		const pasteRectSizePixel = Grid.getPixelPosForGridPos(new PIXI.Point(bounding.width + 2, bounding.height + 2));
		this._selectRect.position = Grid.getPixelPosForGridPos(new PIXI.Point(pasteRectPos.x - 1, pasteRectPos.y - 1));
		this._selectRect.width = pasteRectSizePixel.x;
		this._selectRect.height = pasteRectSizePixel.y;
		this._view.addChild(this._selectRect);

		const elementPosOffset = this.calcPasteRectOffset(bounding, pasteRectPos);
		this.addPastingElementsToView(copiedElements, copiedConnPts, elementPosOffset);
	}

	private addPastingElementsToView(copiedElems: Element[], copiedConnPts: PIXI.Point[], offset: PIXI.Point) {
		for (let i = 0; i < copiedElems.length; i++) {
			if (copiedElems[i].typeId === 0) {
				const graphics = new PIXI.Graphics();
				graphics.position = Grid.getPixelPosForGridPosWire(new PIXI.Point(copiedElems[i].pos.x + offset.x, copiedElems[i].pos.y + offset.y));
				this._view.addLineToWireGraphics(
					graphics,
					Grid.getPixelPosForGridPosWire(copiedElems[i].endPos), Grid.getPixelPosForGridPosWire(copiedElems[i].pos)
				);
				this._view.addChild(graphics);
				this.pastingElements.push({
					element: copiedElems[i],
					sprite: graphics
				});
			} else {
				const type = ElementProviderService.staticInstance.getElementById(copiedElems[i].typeId);
				const sprite = CompSpriteGenerator.getComponentSprite(
					type.symbol,
					copiedElems[i].numInputs, copiedElems[i].numOutputs, copiedElems[i].rotation, this._view.zoomPan.currentScale
				);
				sprite.position = Grid.getPixelPosForGridPos(new PIXI.Point(copiedElems[i].pos.x + offset.x, copiedElems[i].pos.y + offset.y));
				this._view.addChild(sprite);
				this.pastingElements.push({
					element: copiedElems[i],
					sprite
				});
			}
		}

		for (let i = 0; i < copiedConnPts.length; i++) {
			const pos = Grid.getPixelPosForGridPosWire(new PIXI.Point(copiedConnPts[i].x + offset.x, copiedConnPts[i].y + offset.y));
			const graphics = new PIXI.Graphics();
			graphics.position = pos;
			this._view.drawConnectionPoint(graphics, pos);
			this._view.addChild(graphics);
			this.pastingConnPoints.push(graphics);
		}
	}

	private cancelPasting() {
		this._currentlyPasting = false;
		for (let i = 0; i < this.pastingElements.length; i++) {
			this.pastingElements[i].sprite.destroy();
		}
		for (let i = 0; i < this.pastingConnPoints.length; i++) {
			this.pastingConnPoints[i].destroy();
		}
		this.pastingConnPoints = [];
		this.pastingElements = [];
	}

	private calcPasteRectPos(): PIXI.Point {
		return Grid.getGridPosForPixelPos(
			new PIXI.Point(
				(this._view.htmlContainer.offsetWidth / 3 - this._view.zoomPan.positionX) / this._view.zoomPan.currentScale,
				(this._view.htmlContainer.offsetHeight / 3 - this._view.zoomPan.positionY) / this._view.zoomPan.currentScale
			)
		);
	}

	private calcPasteRectOffset(bounding: PIXI.Rectangle, pasteRectPos: PIXI.Point): PIXI.Point {
		return new PIXI.Point(
			pasteRectPos.x - bounding.x,
			pasteRectPos.y - bounding.y
		);
	}

	private selectSingleComp(elem: ElementSprite) {
		this.resetSelectionToOldPosition();
		this.clearSelection();
		this._singleSelectedElement = elem.element;
		delete this._actionStartPos;
		this._view.removeChild(this._selectRect);
		elem.sprite.tint = ThemingService.staticInstance.getEditorColor('selectTint');
		elem.sprite.parent.removeChild(elem.sprite);
		elem.sprite.position = Grid.getPixelPosForGridPos(elem.element.pos);
		this._view.addChild(elem.sprite);
		SelectionService.staticInstance.selectComponent(elem.element.id);
	}

	private cleanUp() {
		this.resetSelectionToOldPosition();
		this.cancelPasting();
		this.clearSelection();
		delete this._actionStartPos;
		delete this._newWireDir;
		delete this._lastMousePos;
		this._drawingSelectRect = false;
		this._drawingSelectRect = false;
		this._currentlyDragging = false;
		this._currentlyPasting = false;
		this._view.removeChild(this._selectRect);
		this._view.removeChild(this._newWire);
		this._view.ticker.singleFrame();
	}

	public destroy() {
		this._workModeSubscription.unsubscribe();
	}
}
