import {EditorView} from './editor-view';
import {Grid} from './grid';
import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {Element} from '../element';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {SelectionService} from '../../services/selection/selection.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {CollisionFunctions} from '../collision-functions';
import {merge, Subscription} from 'rxjs';
import {ThemingService} from '../../services/theming/theming.service';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter} from 'rxjs/operators';
import {CopyService} from '../../services/copy/copy.service';
import {getStaticDI} from '../get-di';
import {NgZone} from '@angular/core';
import {LGraphics} from './graphics/l-graphics';
import {LGraphicsResolver} from './graphics/l-graphics-resolver';
import {PopupService} from '../../services/popup/popup.service';
import {TextComponent} from '../../components/popup/popup-contents/text/text.component';
import {ElementTypeId} from '../element-types/element-type-ids';

export class ViewInteractionManager {

	private readonly _view: EditorView;

	private _workModeSubscription: Subscription;
	private _pasteSubscription: Subscription;

	private _actionStartPos: PIXI.Point;
	private _lastMousePos: PIXI.Point;

	private _newCompSprite: LGraphics;
	private _draggingNewComp = false;

	private _newWireDir: 'hor' | 'ver';
	private _drawingNewWire = false;
	private readonly _newWire: PIXI.Graphics;

	private _singleSelectedElement: Element;
	private _currentlyDragging = false;
	private _drawingSelectRect = false;
	private _currentlyPasting = false;
	private readonly _selectRect: PIXI.Graphics;

	public pastingElements: LGraphics[] = [];
	public pastingConnPoints: PIXI.Graphics[] = [];

	private copyService = getStaticDI(CopyService);
	private projectsService = getStaticDI(ProjectsService);
	private workModeService = getStaticDI(WorkModeService);
	private elemProvService = getStaticDI(ElementProviderService);
	private themingService = getStaticDI(ThemingService);
	private selectionService = getStaticDI(SelectionService);

	constructor(view: EditorView) {
		this._view = view;
		this._selectRect = new PIXI.Graphics();
		this._selectRect.beginFill(this.themingService.getEditorColor('selectRect'), 0.3);
		this._selectRect.drawRect(0, 0, 1, 1);

		this._newWire = new PIXI.Graphics();

		this.addEventListenersToView();
		this.addEventListenersToSelectRect();

		this._workModeSubscription = merge(
			this.workModeService.currentWorkMode$,
			getStaticDI(ProjectInteractionService).onElementsDelete$,
		).subscribe(_ => this.cleanUp());

		this._pasteSubscription = getStaticDI(ProjectInteractionService).onPaste$.pipe(
			filter(_ => this._view.projectId === this.projectsService.currProject.id)
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

	public addEventListenersToNewElement(sprite: LGraphics) {
		getStaticDI(NgZone).runOutsideAngular(() => {
			sprite.interactive = true;
			sprite.on('pointerdown', (e: InteractionEvent) => this.handlePointerDownOnElement(e, sprite));
		});
	}

	private handlePointerDownOnView(e: InteractionEvent) {
		let addPointerMoveEvent = false;
		if (this.workModeService.currentWorkMode === 'select' && e.data.button === 0) {
			this.addSelectRectOrResetSelection(e);
			addPointerMoveEvent = true;
		} else if (this.workModeService.currentWorkMode === 'buildWire' && e.data.button === 0) {
			this.startDrawingNewWire(e);
			addPointerMoveEvent = true;
		} else if (this.workModeService.currentWorkMode === 'connectWire' && e.data.button === 0) {
			this.connectOrDisconnectWires(e);
			addPointerMoveEvent = true;
		} else if (this.workModeService.currentWorkMode === 'buildComponent'
			&& this.workModeService.currentComponentToBuild !== 0
			&& e.data.button === 0
		) {
			this.startDraggingNewComponent(e);
			addPointerMoveEvent = true;
		} else if (this.workModeService.currentWorkMode === 'text' && e.data.button === 0 && e.target === this._view) {
			this.placeText(e);
		}
		this._view.requestSingleFrame();
		if (addPointerMoveEvent) this._view.on('pointermove', (e1: InteractionEvent) => this.handlePointerMoveOnView(e1));
	}

	private handlePointerUpOnView(e: InteractionEvent) {
		if ((this.workModeService.currentWorkMode === 'select' || this._currentlyPasting) && e.data.button === 0) {
			this.selectOrApplyMove();
		} else if (this.workModeService.currentWorkMode === 'buildWire' && e.data.button === 0) {
			this.addWire(e);
		} else if (this._draggingNewComp) {
			this.placeNewComp();
		}
		this._view.requestSingleFrame();
		this._view.removeAllListeners('pointermove');
	}

	private handlePointerMoveOnView(e: InteractionEvent) {
		if (this.workModeService.currentWorkMode === 'select' || this._currentlyPasting) {
			this.drawSelectRectOrMove(e);
		} else if (this.workModeService.currentWorkMode === 'buildWire') {
			this.drawNewWire(e);
		} else if (this._draggingNewComp) {
			this.dragNewComp(e);
		}
		this._view.requestSingleFrame();
	}

	private handlePointerDownOnSelectRect(e: InteractionEvent) {
		if (this.workModeService.currentWorkMode === 'select' || this._currentlyPasting) {
			this.startDragging(e);
			this._view.requestSingleFrame();
		}
	}

	private handlePointerDownOnElement(e: InteractionEvent, elem: LGraphics) {
		if (this.workModeService.currentWorkMode === 'select' && e.data.button === 0) {
			if (this._singleSelectedElement === elem.element) {
				this.startDragging(e);
			} else {
				this.selectSingleComp(elem);
			}
			this._view.requestSingleFrame();
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
			if (this.selectionService.selectedIds().length === 0) {
				this._view.removeChild(this._selectRect);
			}
		} else if (this._currentlyDragging) {
			this._currentlyDragging = false;
			if (this._currentlyPasting) {
				const elementsToPaste = this.pastingElements.map(es => es.element);
				const endPos = Grid.getGridPosForPixelPos(this.pastingElements[0].position);
				if (this.projectsService.currProject.addElements(
					elementsToPaste, new PIXI.Point(endPos.x - elementsToPaste[0].pos.x, endPos.y - elementsToPaste[0].pos.y))
				) {
					this.projectsService.inputsOutputsCustomComponentChanged(this._view.projectId);
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

				if (this.projectsService.currProject.moveElementsById(
					this.selectionService.selectedIds(), movedDif)
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
		this.projectsService.currProject.toggleWireConnection(pos);
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
		this.projectsService.currProject.addWire(wire1StartPos, wire1End2StartPos, wire2EndPos);

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
			this._newWire.lineStyle(1 / this._view.zoomPan.currentScale, this.themingService.getEditorColor('wire'));
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
		const typeId = this.workModeService.currentComponentToBuild;
		const elemType = this.elemProvService.getElementById(typeId);
		if (elemType.numInputs === 0 && elemType.numOutputs === 0) return;
		this._draggingNewComp = true;
		this._newCompSprite = LGraphicsResolver.getLGraphicsFromType(this._view.zoomPan.currentScale, typeId);
		this._newCompSprite.position = Grid.getPixelPosOnGridForPixelPos(e.data.getLocalPosition(this._view));
		this._view.addChild(this._newCompSprite);
	}

	private dragNewComp(e: InteractionEvent) {
		this._newCompSprite.position = Grid.getPixelPosOnGridForPixelPos(e.data.getLocalPosition(this._view));
	}

	private placeNewComp() {
		if (this._newCompSprite.position.x > 0 && this._newCompSprite.position.y > 0) {
			const typeIdToBuild = this.workModeService.currentComponentToBuild;
			this.projectsService.currProject.addElement(
				typeIdToBuild,
				Grid.getGridPosForPixelPos(this._newCompSprite.position)
			);
			if (this.elemProvService.isPlugElement(typeIdToBuild)) {
				this.projectsService.inputsOutputsCustomComponentChanged(this._view.projectId);
			}
		}
		this._view.removeChild(this._newCompSprite);
		this._newCompSprite.destroy();
		this._draggingNewComp = false;
	}

	private applyDraggingPositionChangeToSelection(dx: number, dy: number) {
		if (this._currentlyPasting) {
			for (let i = 0; i < this.pastingElements.length; i++) {
				this.pastingElements[i].position.x += dx;
				this.pastingElements[i].position.y += dy;
			}
			for (let i = 0; i < this.pastingConnPoints.length; i++) {
				this.pastingConnPoints[i].position.x += dx;
				this.pastingConnPoints[i].position.y += dy;
			}
			return;
		}
		this.selectionService.selectedIds().forEach(id => {
			const sprite = this._view.allElements.get(id);
			sprite.position.x += dx;
			sprite.position.y += dy;
		});
		this.selectionService.selectedConnections().forEach(point => {
			const sprite = this._view.connectionPoints.get(`${point.x}:${point.y}`);
			sprite.position.x += dx;
			sprite.position.y += dy;
		});
	}

	private resetSelectionToOldPosition() {
		this.selectionService.selectedIds(this._view.projectId).forEach(id => {
			if (!this._view.allElements.has(id)) return;
			const lGraphics = this._view.allElements.get(id);
			this._view.removeChild(lGraphics);

			this._view.addToCorrectChunk(lGraphics, lGraphics.element.pos);
			this._view.setLocalChunkPos(lGraphics.element, lGraphics);
		});
		this.selectionService.selectedConnections(this._view.projectId).forEach(point => {
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
		this.selectionService.selectedIds(this._view.projectId).forEach(id => {
			if (this._view.allElements.has(id))
				this._view.allElements.get(id).setSelected(false);
		});
		this.selectionService.selectedConnections(this._view.projectId).forEach(point => {
			const key = `${point.x}:${point.y}`;
			if (this._view.connectionPoints.has(key))
				this._view.connectionPoints.get(key).tint = 0xffffff;
		});
		this.selectionService.clearSelection(this._view.projectId);
		delete this._singleSelectedElement;
	}

	private selectInRect(start: PIXI.Point, end: PIXI.Point) {
		if (start.x === end.x && start.y === end.y) return;
		this.clearSelection();
		const selected = this.selectionService.selectFromRect(this.projectsService.currProject, start, end);
		selected.forEach(id => {
			const lGraphics = this._view.allElements.get(id);
			lGraphics.setSelected(true);

			lGraphics.parent.removeChild(lGraphics);
			this._view.addChild(lGraphics);

			if (lGraphics.element.typeId === ElementTypeId.WIRE) {
				lGraphics.position = Grid.getPixelPosForGridPosWire(lGraphics.element.pos);
			} else {
				lGraphics.position = Grid.getPixelPosForGridPos(lGraphics.element.pos);
			}
		});
		this.selectionService.selectedConnections().forEach(point => {
			const element = this._view.connectionPoints.get(`${point.x}:${point.y}`);
			element.tint = this.themingService.getEditorColor('selectTint');
			element.parent.removeChild(element);
			this._view.addChild(element);
			const pos = Grid.getPixelPosForGridPosWire(point);
			const size = this._view.calcConnPointSize();
			element.position = this._view.adjustConnPointPosToSize(pos, size);
		});
	}

	private onPaste() {
		if (this._currentlyPasting || this.copyService.copiedElements.length === 0) return;
		this.cleanUp();
		this._currentlyPasting = true;
		const copiedElements = this.copyService.copiedElements;
		const copiedConnPts = this.copyService.copiedConPoints;
		const bounding = this.copyService.getCopiedElementsBoundingBox();
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
			if (copiedElems[i].typeId === ElementTypeId.WIRE) {
				const graphics = LGraphicsResolver.getLGraphicsFromElement(
					this._view.zoomPan.currentScale,
					copiedElems[i]
				);
				graphics.position = Grid.getPixelPosForGridPosWire(new PIXI.Point(copiedElems[i].pos.x + offset.x, copiedElems[i].pos.y + offset.y));
				this._view.addChild(graphics);
				this.pastingElements.push(graphics);
			} else {
				const sprite = LGraphicsResolver.getLGraphicsFromElement(
					this._view.zoomPan.currentScale,
					copiedElems[i]
				);
				sprite.position = Grid.getPixelPosForGridPos(new PIXI.Point(copiedElems[i].pos.x + offset.x, copiedElems[i].pos.y + offset.y));
				this._view.addChild(sprite);
				this.pastingElements.push(sprite);
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
			this.pastingElements[i].destroy();
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

	private placeText(e: InteractionEvent) {
		const pos = Grid.getGridPosForPixelPos(e.data.getLocalPosition(this._view));
		getStaticDI(NgZone).run(async () => {
			const text = await getStaticDI(PopupService).showPopup(TextComponent, 'POPUP.TEXT.TITLE', false);
			if (!text) return;
			this.projectsService.currProject.addText(text, pos);
		});
	}

	private selectSingleComp(elem: LGraphics) {
		this.resetSelectionToOldPosition();
		this.clearSelection();
		this._singleSelectedElement = elem.element;
		delete this._actionStartPos;
		this._view.removeChild(this._selectRect);
		elem.setSelected(true);
		elem.parent.removeChild(elem);
		elem.position = Grid.getPixelPosForGridPos(elem.element.pos);
		this._view.addChild(elem);
		this.selectionService.selectComponent(elem.element.id);
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
		this._view.requestSingleFrame();
	}

	public destroy() {
		this._view.removeAllListeners('pointermove');
		this._view.removeAllListeners('pointerdown');
		this._view.removeAllListeners('pointerup');
		this._view.removeAllListeners('pointerupoutside');
		this._selectRect.removeAllListeners('pointerdown');
		this._workModeSubscription.unsubscribe();
	}
}
