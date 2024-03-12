// @ts-strict-ignore
import * as PIXI from 'pixi.js';
import { EditorView } from './editor-view';
import { Subject } from 'rxjs';
import { LGraphics } from './graphics/l-graphics';
import { getStaticDI } from '../get-di';
import { WorkModeService } from '../../services/work-mode/work-mode.service';
import { filter, takeUntil } from 'rxjs/operators';
import { NgZone } from '@angular/core';
import { ThemingService } from '../../services/theming/theming.service';
import { ViewIntManState, WireDir } from './view-int-man-states';
import { ElementProviderService } from '../../services/element-provider/element-provider.service';
import { LGraphicsResolver } from './graphics/l-graphics-resolver';
import { PosHelper } from './pos-helper';
import { ProjectsService } from '../../services/projects/projects.service';
import { SelectionService } from '../../services/selection/selection.service';
import { ElementTypeId } from '../element-types/element-type-ids';
import { Grid } from './grid';
import { TextComponent } from '../../components/popup-contents/text/text.component';
import { CollisionFunctions } from '../collision-functions';
import { CopyService } from '../../services/copy/copy.service';
import { Elements } from '../elements';
import { ConnectionPoint } from './graphics/connection-point';
import { PopupService } from '../../services/popup/popup.service';
import { WorkMode } from '../work-modes';
import { EditorInteractionService } from '../../services/editor-interaction/editor-interaction.service';
import { EditorAction } from '../editor-action';
import { Project } from '../project';

export class ViewInteractionManager {
	private readonly _view: EditorView;

	private readonly _project: Project;

	private _destroySubject = new Subject<void>();

	private readonly _selectRect: PIXI.Graphics;

	private readonly _wireGraphics: PIXI.Graphics;
	private _wireDirection: WireDir;

	private _selectedElements: LGraphics[];
	private _selectedConnPoints: {
		graphics: ConnectionPoint;
		pos: PIXI.Point;
	}[];
	private _selectionNewElements: boolean;

	private _actionPos: PosHelper;

	private _state: ViewIntManState = ViewIntManState.IDLE;

	private workModeSer = getStaticDI(WorkModeService);
	private editorInteractionSer = getStaticDI(EditorInteractionService);
	private themingSer = getStaticDI(ThemingService);
	private elemProvSer = getStaticDI(ElementProviderService);
	private projectsSer = getStaticDI(ProjectsService);
	private selectionSer = getStaticDI(SelectionService);
	private copySer = getStaticDI(CopyService);

	constructor(view: EditorView, project: Project) {
		this._view = view;
		this._project = project;

		this._selectRect = new PIXI.Graphics();
		this._selectRect.beginFill(
			this.themingSer.getEditorColor('selectRect'),
			0.3
		);
		this._selectRect.drawRect(0, 0, 1, 1);
		this._selectRect.interactive = true;
		this._selectRect.zIndex = 10;
		this._selectRect.visible = false;
		this._view.addChild(this._selectRect);

		this._wireGraphics = new PIXI.Graphics();
		this._view.addChild(this._wireGraphics);

		this.initEventListeners();

		this.workModeSer.currentWorkMode$
			.pipe(takeUntil(this._destroySubject))
			.subscribe(() => this.cleanUp(true));

		this.editorInteractionSer
			.subscribeEditorAction(EditorAction.UNDO, EditorAction.REDO)
			.pipe(
				takeUntil(this._destroySubject),
				filter(() => this._view.project.id === this.projectsSer.currProject.id)
			)
			.subscribe(() => this.cleanUp(true));

		this.editorInteractionSer
			.subscribeEditorAction(EditorAction.DELETE, EditorAction.CUT)
			.pipe(
				takeUntil(this._destroySubject),
				filter(() => this._view.project.id === this.projectsSer.currProject.id)
			)
			.subscribe(() => this.cleanUp());

		this.editorInteractionSer
			.subscribeEditorAction(EditorAction.PASTE)
			.pipe(
				takeUntil(this._destroySubject),
				filter(() => this._view.project.id === this.projectsSer.currProject.id)
			)
			.subscribe(() => this.startPaste());
	}

	public addNewElement(lGraphics: LGraphics) {
		getStaticDI(NgZone).runOutsideAngular(() => {
			lGraphics.interactive = true;
			lGraphics.on('pointerup', () => this.pUpElement(lGraphics));
			lGraphics.on('pointerdown', (e: PIXI.InteractionEvent) =>
				this.pDownElement(e, lGraphics)
			);
		});
	}

	private initEventListeners() {
		getStaticDI(NgZone).runOutsideAngular(() => {
			this._view.on('pointerdown', (e: PIXI.InteractionEvent) =>
				this.pDownView(e)
			);
			this._view.on('pointerup', (e: PIXI.InteractionEvent) => this.pUpView(e));
			this._view.on('pointerupoutside', (e: PIXI.InteractionEvent) =>
				this.pUpView(e)
			);
			this._view.on('pointermove', (e: PIXI.InteractionEvent) =>
				this.pMoveView(e)
			);
			this._selectRect.on('pointerdown', (e: PIXI.InteractionEvent) =>
				this.pDownSelectRect(e)
			);
		});
	}

	public updateSelectionScale() {
		for (const lGraphics of this._selectedElements || []) {
			lGraphics.updateScale(this.currScale);
		}
		for (const point of this._selectedConnPoints || []) {
			point.graphics.updateScale(this.currScale);
		}
	}

	private pDownView(e: PIXI.InteractionEvent) {
		if (e.data.button !== 0) return;

		if (this.workModeSer.currentWorkMode === WorkMode.ERASER) {
			this.cleanUp(true);
			this.startEraser(e);
			return;
		}

		if (e.target !== this._view) return;
		this.cleanUp(true);

		switch (this.workModeSer.currentWorkMode) {
			case WorkMode.COMPONENT:
				this.startBuildComp(e);
				break;
			case WorkMode.WIRE:
				this.startBuildWire(e);
				break;
			case WorkMode.CONN_WIRE:
				this.toggleWireConn(e);
				break;
			case WorkMode.TEXT:
				this.placeText(e);
				break;
			case WorkMode.SELECT:
				this.startSelection(e, ViewIntManState.SELECT);
				break;
			case WorkMode.CUT_SELECT:
				this.startSelection(e, ViewIntManState.SELECT_CUT);
				break;
		}
	}

	private pUpView(e: PIXI.InteractionEvent) {
		switch (this._state) {
			case ViewIntManState.NEW_COMP:
				this.buildNewComp(e);
				break;
			case ViewIntManState.SELECT:
				this.selectFromRect();
				break;
			case ViewIntManState.SELECT_CUT:
				this.selectCutFromRect();
				break;
			case ViewIntManState.DRAGGING:
			case ViewIntManState.CUT_DRAGGING:
				this.applyDrag();
				break;
			case ViewIntManState.NEW_WIRE:
				this.buildNewWire();
				break;
			case ViewIntManState.PASTE_DRAGGING:
				this.applyPaste();
				break;
			case ViewIntManState.USING_ERASER:
				this.stopEraser();
				break;
		}
	}

	private pMoveView(e: PIXI.InteractionEvent) {
		switch (this._state) {
			case ViewIntManState.NEW_COMP:
			case ViewIntManState.DRAGGING:
			case ViewIntManState.CUT_DRAGGING:
			case ViewIntManState.PASTE_DRAGGING:
				this.dragSelection(e);
				break;
			case ViewIntManState.SELECT:
			case ViewIntManState.SELECT_CUT:
				this.dragSelectRect(e);
				break;
			case ViewIntManState.NEW_WIRE:
				this.dragNewWire(e);
				break;
			case ViewIntManState.USING_ERASER:
				this.eraseComponents(e);
				break;
		}
	}

	private pDownSelectRect(e: PIXI.InteractionEvent) {
		if (e.data.button !== 0) return;

		if (
			this._state === ViewIntManState.WAIT_FOR_DRAG ||
			this._state === ViewIntManState.WAIT_FOR_PASTE_DRAG ||
			this._state === ViewIntManState.WAIT_FOR_CUT_DRAG
		) {
			switch (this._state) {
				case ViewIntManState.WAIT_FOR_DRAG:
					this._state = ViewIntManState.DRAGGING;
					break;
				case ViewIntManState.WAIT_FOR_PASTE_DRAG:
					this._state = ViewIntManState.PASTE_DRAGGING;
					break;
				case ViewIntManState.WAIT_FOR_CUT_DRAG:
					this._state = ViewIntManState.CUT_DRAGGING;
					break;
			}
			if (!this._actionPos) {
				this._actionPos = new PosHelper(
					e,
					this._view,
					Grid.getPixelPosForGridPos(this._selectedElements[0].element.pos)
				);
			} else {
				this._actionPos.addDragPos(e, this._view);
			}
		}
	}

	private pUpElement(lGraphics: LGraphics) {
		if (
			this.workModeSer.currentWorkMode === WorkMode.COMPONENT ||
			this.workModeSer.currentWorkMode === WorkMode.ERASER ||
			this._state === ViewIntManState.NEW_WIRE ||
			this._state === ViewIntManState.DRAGGING ||
			this._state === ViewIntManState.CUT_DRAGGING ||
			this._state === ViewIntManState.SELECT ||
			this._state === ViewIntManState.SELECT_CUT
		) {
			return;
		}

		this.cleanUp(true);
		this._state = ViewIntManState.WAIT_FOR_DRAG;
		this.selectionSer.selectComponent(lGraphics.element.id);
		lGraphics.setSelected(true);
		lGraphics.parent.removeChild(lGraphics);
		lGraphics.position = Grid.getPixelPosForGridPos(lGraphics.element.pos);
		this._view.addChild(lGraphics);
		this._selectedElements = [lGraphics];
		this._selectionNewElements = false;
		this._view.requestSingleFrame();
	}

	private pDownElement(e: PIXI.InteractionEvent, lGraphics: LGraphics) {
		if (e.data.button !== 0) return;
		if (
			this._state === ViewIntManState.WAIT_FOR_DRAG &&
			!this._selectRect.visible &&
			this._selectedElements.includes(lGraphics)
		) {
			this._state = ViewIntManState.DRAGGING;
			if (!this._actionPos)
				this._actionPos = new PosHelper(
					e,
					this._view,
					(lGraphics.position as PIXI.ObservablePoint).clone()
				);
		}
	}

	private startBuildComp(e: PIXI.InteractionEvent) {
		const typeId = this.workModeSer.currentComponentToBuild;
		const elemType = this.elemProvSer.getElementById(typeId);
		if (elemType.numInputs === 0 && elemType.numOutputs === 0) return;
		this._state = ViewIntManState.NEW_COMP;
		this._actionPos = new PosHelper(e, this._view);
		const newElem = LGraphicsResolver.getLGraphicsFromType(
			this.currScale,
			typeId
		);
		newElem.position = this._actionPos.pixelPosOnGridStart;
		this._view.addChild(newElem);
		this._selectedElements = [newElem];
		this._selectionNewElements = true;
		this._view.requestSingleFrame();
	}

	private startBuildWire(e: PIXI.InteractionEvent) {
		this._state = ViewIntManState.NEW_WIRE;
		this._actionPos = new PosHelper(e, this._view);
		this._wireGraphics.position = this._actionPos.pixelPosOnGridStartWire;
		this._wireGraphics.visible = true;
	}

	private dragNewWire(e: PIXI.InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		if (
			this._wireDirection === undefined &&
			CollisionFunctions.distance(
				this._actionPos.gridPosStart,
				this._actionPos.lastGridPosDrag
			) >= 1
		) {
			if (
				this._actionPos.gridPosStart.x === this._actionPos.lastGridPosDrag.x
			) {
				this._wireDirection = WireDir.VER;
			} else if (
				this._actionPos.gridPosStart.y === this._actionPos.lastGridPosDrag.y
			) {
				this._wireDirection = WireDir.HOR;
			} else {
				this._wireDirection = WireDir.VER;
			}
		}
		this._wireGraphics.clear();
		this._wireGraphics.lineStyle(
			1 / this._view.zoomPan.currentScale,
			this.themingSer.getEditorColor('wire')
		);
		this._wireGraphics.moveTo(0, 0);
		const endPosAbsolute = this._actionPos.lastPixelPosOnGridWire;
		const endPosRel = new PIXI.Point(
			endPosAbsolute.x - this._actionPos.pixelPosOnGridStartWire.x,
			endPosAbsolute.y - this._actionPos.pixelPosOnGridStartWire.y
		);
		switch (this._wireDirection) {
			case WireDir.HOR:
				this._wireGraphics.lineTo(endPosRel.x, 0);
				this._wireGraphics.lineTo(endPosRel.x, endPosRel.y);
				break;
			case WireDir.VER:
				this._wireGraphics.lineTo(0, endPosRel.y);
				this._wireGraphics.lineTo(endPosRel.x, endPosRel.y);
				break;
		}
		this._view.requestSingleFrame();
	}

	private buildNewWire() {
		const startPos = this._actionPos.gridPosStart;
		const endPos = this._actionPos.lastGridPosDrag;
		this._project.addWire(
			startPos,
			this._wireDirection === WireDir.HOR
				? new PIXI.Point(endPos.x, startPos.y)
				: new PIXI.Point(startPos.x, endPos.y),
			endPos
		);
		this.cleanUp();
	}

	private startSelection(e: PIXI.InteractionEvent, selMode: ViewIntManState) {
		this._state = selMode;
		this._actionPos = new PosHelper(e, this._view);
		this._selectRect.width = 0;
		this._selectRect.height = 0;
		this._selectRect.position = this._actionPos.pixelPosStartDrag;
		this._selectRect.visible = true;
	}

	private dragSelectRect(e: PIXI.InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		const selSize = this._actionPos.getPixelPosDiffFromStart();
		this._selectRect.width = selSize.x;
		this._selectRect.height = selSize.y;
		this._view.requestSingleFrame();
	}

	private selectFromRect() {
		const selected = this.selectionSer.selectFromRect(
			this._project,
			this._actionPos.gridPosFloatStart,
			this._actionPos.lastGridPosFloat
		);
		if (selected.length === 0) {
			this.cleanUp();
			return;
		}
		this.setSelected(selected, this.selectionSer.selectedConnections());
		this._selectionNewElements = false;
		delete this._actionPos;
		this._state = ViewIntManState.WAIT_FOR_DRAG;
		this._view.requestSingleFrame();
	}

	private selectCutFromRect() {
		const actions = this.selectionSer.cutFromRect(
			this._project,
			this._actionPos.gridPosFloatStart,
			this._actionPos.lastGridPosFloat
		);

		this._view.applyActionsToView(actions);
		this.setSelected(
			this.selectionSer.selectedIds(),
			this.selectionSer.selectedConnections()
		);

		if (this.selectionSer.selectedIds().length === 0) {
			this.cleanUp();
			return;
		}

		this._selectionNewElements = false;
		delete this._actionPos;
		this._state = ViewIntManState.WAIT_FOR_CUT_DRAG;
		this._view.requestSingleFrame();
	}

	private setSelected(elemIds: number[], connPts: PIXI.Point[]) {
		this._selectedElements = [];
		for (const selId of elemIds) {
			if (!this._view.allElements.has(selId)) {
				console.log('Element not in View!');
				continue;
			}
			const lGraphics = this._view.allElements.get(selId);
			lGraphics.setSelected(true);
			lGraphics.parent.removeChild(lGraphics);
			this._view.addChild(lGraphics);
			if (lGraphics.element.typeId === ElementTypeId.WIRE) {
				lGraphics.position = Grid.getPixelPosForGridPosWire(
					lGraphics.element.pos
				);
			} else {
				lGraphics.position = Grid.getPixelPosForGridPos(lGraphics.element.pos);
			}
			this._selectedElements.push(lGraphics);
		}
		this._selectedConnPoints = [];
		for (const point of connPts) {
			const connPoint = this._view.connectionPoints.get(
				`${point.x}:${point.y}`
			);
			if (!connPoint) {
				continue;
			}

			connPoint.setSelected(true);
			connPoint.parent.removeChild(connPoint);
			this._view.addChild(connPoint);
			connPoint.setPosition(point, false, this.currScale);
			this._selectedConnPoints.push({ graphics: connPoint, pos: point });
		}
	}

	private buildNewComp(e: PIXI.InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		this._project.addElement(
			this.workModeSer.currentComponentToBuild,
			this._actionPos.lastGridPosDrag
		);
		if (
			this.elemProvSer.isPlugElement(this.workModeSer.currentComponentToBuild)
		) {
			this.projectsSer.inputsOutputsCustomComponentChanged(this._project);
		}
		this.cleanUp();
	}

	private dragSelection(e: PIXI.InteractionEvent) {
		const diff = this._actionPos.addDragPos(e, this._view);
		for (const lGraphics of this._selectedElements) {
			lGraphics.position.x += diff.x;
			lGraphics.position.y += diff.y;
		}
		for (const connPoint of this._selectedConnPoints || []) {
			connPoint.graphics.addOffsetToPos(
				Grid.getGridPosForPixelPos(diff),
				this.currScale
			);
		}
		if (this._selectRect.visible) {
			this._selectRect.x += diff.x;
			this._selectRect.y += diff.y;
		}
		this._view.requestSingleFrame();
	}

	private applyDrag() {
		if (
			this._project.moveElementsById(
				this.selectionSer.selectedIds(),
				this._actionPos.getGridPosDiffFromStart(
					this._selectedElements[0].position
				)
			)
		) {
			this.cleanUp(true);
		} else {
			switch (this._state) {
				case ViewIntManState.DRAGGING:
					this._state = ViewIntManState.WAIT_FOR_DRAG;
					break;
				case ViewIntManState.PASTE_DRAGGING:
					this._state = ViewIntManState.WAIT_FOR_PASTE_DRAG;
					break;
				case ViewIntManState.CUT_DRAGGING:
					this._state = ViewIntManState.WAIT_FOR_CUT_DRAG;
					break;
			}
		}
	}

	private placeText(e: PIXI.InteractionEvent) {
		const pos = Grid.getGridPosForPixelPos(e.data.getLocalPosition(this._view));
		getStaticDI(NgZone).run(async () => {
			const text = await getStaticDI(PopupService).showPopup(
				TextComponent,
				'POPUP.TEXT.TITLE',
				false
			);
			if (!text) return;
			this._project.addText(text, pos);
		});
		this.cleanUp();
	}

	private toggleWireConn(e: PIXI.InteractionEvent) {
		this._actionPos = new PosHelper(e, this._view);
		this._project.toggleWireConnection(this._actionPos.gridPosStart);
		this.cleanUp();
	}

	private startPaste() {
		if (this.copySer.copiedElements.length === 0) return;
		this.cleanUp(true);
		this._state = ViewIntManState.WAIT_FOR_PASTE_DRAG;
		const bounding = this.copySer.getCopiedElementsBoundingBox();
		const pasteRectPos = Grid.getGridPosForPixelPos(
			new PIXI.Point(
				(this._view.htmlContainer.offsetWidth / 3 -
					this._view.zoomPan.positionX) /
					this.currScale,
				(this._view.htmlContainer.offsetHeight / 3 -
					this._view.zoomPan.positionY) /
					this.currScale
			)
		);
		const elemPosOffset = new PIXI.Point(
			pasteRectPos.x - bounding.x,
			pasteRectPos.y - bounding.y
		);
		const pasteRectSizePixel = Grid.getPixelPosForGridPos(
			new PIXI.Point(bounding.width + 2, bounding.height + 2)
		);
		this._selectRect.position = Grid.getPixelPosForGridPos(
			new PIXI.Point(pasteRectPos.x - 1, pasteRectPos.y - 1)
		);
		this._selectRect.width = pasteRectSizePixel.x;
		this._selectRect.height = pasteRectSizePixel.y;
		this._selectRect.visible = true;
		this._selectedElements = this.copySer.copiedElements
			.filter((el) => {
				if (this._project.type === 'project') {
					return !this.elemProvSer.isPlugElement(el.typeId);
				}
				return true;
			})
			.map((el) => {
				const lGraphics = LGraphicsResolver.getLGraphicsFromElement(
					this.currScale,
					el
				);
				lGraphics.setSelected(true);
				this._view.addChild(lGraphics);
				if (lGraphics.element.typeId === ElementTypeId.WIRE) {
					lGraphics.position = Grid.getPixelPosForGridPosWire(
						new PIXI.Point(
							lGraphics.element.pos.x + elemPosOffset.x,
							lGraphics.element.pos.y + elemPosOffset.y
						)
					);
				} else {
					lGraphics.position = Grid.getPixelPosForGridPos(
						new PIXI.Point(
							lGraphics.element.pos.x + elemPosOffset.x,
							lGraphics.element.pos.y + elemPosOffset.y
						)
					);
				}
				return lGraphics;
			});
		this._selectedConnPoints = this.copySer.copiedConPoints.map((point) => {
			const pos = new PIXI.Point(
				point.x + elemPosOffset.x,
				point.y + elemPosOffset.y
			);
			const graphics = new ConnectionPoint(pos, false, this.currScale);
			graphics.setSelected(true);
			this._view.addChild(graphics);
			return { graphics, pos: point };
		});
		this._selectionNewElements = true;
		this._view.requestSingleFrame();
	}

	private applyPaste() {
		const elementsToAdd = this._selectedElements
			.filter((lg) => {
				if (this._project.type === 'project') {
					return !this.elemProvSer.isPlugElement(lg.element.typeId);
				}
				return true;
			})
			.map((lg) => Elements.clone(lg.element));

		if (
			this._project.addElements(
				elementsToAdd,
				this._actionPos.getGridPosDiffFromStart(
					this._selectedElements[0].position
				)
			)
		) {
			this.cleanUp(true);
		} else {
			this._state = ViewIntManState.WAIT_FOR_PASTE_DRAG;
		}
	}

	private startEraser(e: PIXI.InteractionEvent) {
		this._state = ViewIntManState.USING_ERASER;
		this._actionPos = new PosHelper(e, this._view);
		this._project.eraseElements(
			this._actionPos.previousGridPosFloat,
			this._actionPos.lastGridPosFloat
		);
	}

	private eraseComponents(e: PIXI.InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		this._project.eraseElements(
			this._actionPos.previousGridPosFloat,
			this._actionPos.lastGridPosFloat
		);
	}

	private stopEraser() {
		this._project.stopErase();
		this.cleanUp();
	}

	private get currScale() {
		return this._view.zoomPan.currentScale;
	}

	private cleanUp(cleanUpSelectedElements = false) {
		if (this._state === ViewIntManState.WAIT_FOR_CUT_DRAG)
			this.selectionSer.cancelCut(this._project);
		this._state = ViewIntManState.IDLE;
		this.selectionSer.clearSelection();
		if (cleanUpSelectedElements || this._selectionNewElements)
			this.cleanUpSelectedElements();
		this._selectRect.visible = false;
		this._wireGraphics.visible = false;
		this._wireGraphics.clear();
		delete this._wireDirection;
		this._selectedElements = [];
		this._selectedConnPoints = [];
		delete this._selectionNewElements;
		delete this._actionPos;
		this._view.requestSingleFrame();
	}

	private cleanUpSelectedElements() {
		for (const lGraphics of this._selectedElements || []) {
			if (this._selectionNewElements) {
				lGraphics.destroy();
			} else {
				try {
					if (this._view.addToCorrectChunk(lGraphics, lGraphics.element.pos))
						this._view.setLocalChunkPos(lGraphics.element, lGraphics);
					lGraphics.setSelected(false);
				} catch (e) {
					console.error(e);
				}
			}
		}
		for (const point of this._selectedConnPoints || []) {
			if (this._selectionNewElements) {
				point.graphics.destroy();
			} else {
				try {
					if (this._view.addToCorrectChunk(point.graphics, point.pos)) {
						this._view.removeChild(point.graphics);
						point.graphics.setPosition(point.pos, true, this.currScale);
					}
					point.graphics.setSelected(false);
				} catch (e) {
					console.error(e);
				}
			}
		}
	}

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.complete();
	}
}
