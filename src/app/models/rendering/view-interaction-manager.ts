import * as PIXI from 'pixi.js';
import {EditorView} from './editor-view';
import {merge, Subject} from 'rxjs';
import {LGraphics} from './graphics/l-graphics';
import {getStaticDI} from '../get-di';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {takeUntil} from 'rxjs/operators';
import {NgZone} from '@angular/core';
import {ThemingService} from '../../services/theming/theming.service';
import {ViewIntManState, WireDir} from './view-int-man-states';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {LGraphicsResolver} from './graphics/l-graphics-resolver';
import {PosHelper} from './pos-helper';
import {ProjectsService} from '../../services/projects/projects.service';
import {SelectionService} from '../../services/selection/selection.service';
import {ElementTypeId} from '../element-types/element-type-ids';
import {Grid} from './grid';
import {PopupService} from '../../services/popup/popup.service';
import {TextComponent} from '../../components/popup/popup-contents/text/text.component';
import {CollisionFunctions} from '../collision-functions';
import InteractionEvent = PIXI.interaction.InteractionEvent;

export class ViewInteractionManager {

	private readonly _view: EditorView;

	private _destroySubject = new Subject<void>();

	private readonly _selectRect: PIXI.Graphics;

	private readonly _wireGraphics: PIXI.Graphics;
	private _wireDirection: WireDir;

	private _selectedElements: LGraphics[];
	private _selectedConnPoints: {
		graphics: PIXI.Graphics,
		pos: PIXI.Point
	}[];
	private _selectionNewElements: boolean;

	private _actionPos: PosHelper;

	private _state: ViewIntManState = ViewIntManState.IDLE;

	private workModeSer = getStaticDI(WorkModeService);
	private themingSer = getStaticDI(ThemingService);
	private elemProvSer = getStaticDI(ElementProviderService);
	private projectsSer = getStaticDI(ProjectsService);
	private selectionSer = getStaticDI(SelectionService);

	constructor(view: EditorView) {
		this._view = view;

		this._selectRect = new PIXI.Graphics();
		this._selectRect.beginFill(this.themingSer.getEditorColor('selectRect'), 0.3);
		this._selectRect.drawRect(0, 0, 1, 1);
		this._selectRect.interactive = true;
		this._selectRect.zIndex = 10;
		this._selectRect.visible = false;
		this._view.addChild(this._selectRect);

		this._wireGraphics = new PIXI.Graphics();
		this._view.addChild(this._wireGraphics);

		this.initEventListeners();

		merge(this.workModeSer.currentWorkMode$, getStaticDI(ProjectInteractionService).onElementsDelete$)
			.pipe(takeUntil(this._destroySubject)).subscribe(() => this.cleanUp());
	}

	public addNewElement(lGraphics: LGraphics) {
		getStaticDI(NgZone).runOutsideAngular(() => {
			lGraphics.interactive = true;
			lGraphics.on('pointerup', (e: InteractionEvent) => this.pUpElement(e, lGraphics));
			lGraphics.on('pointerdown', (e: InteractionEvent) => this.pDownElement(e, lGraphics));
		});
	}

	private initEventListeners() {
		getStaticDI(NgZone).runOutsideAngular(() => {
			this._view.on('pointerdown', (e: InteractionEvent) => this.pDownView(e));
			this._view.on('pointerup', (e: InteractionEvent) => this.pUpView(e));
			this._view.on('pointerupoutside', (e: InteractionEvent) => this.pUpView(e));
			this._view.on('pointermove', (e: InteractionEvent) => this.pMoveView(e));
			this._selectRect.on('pointerdown', (e: InteractionEvent) => this.pDownSelectRect(e));
		});
	}

	public updateSelectionScale() {
		for (const lGraphics of this._selectedElements || []) {
			lGraphics.updateScale(this.currScale);
		}
		for (const point of this._selectedConnPoints || []) {
			this._view.drawConnectionPoint(point.graphics, Grid.getPixelPosForGridPosWire(point.pos));
		}
	}

	private pDownView(e: InteractionEvent) {
		if (e.target !== this._view || e.data.button !== 0) return;
		this.cleanUp();
		switch (this.workModeSer.currentWorkMode) {
			case 'buildComponent':
				this.startBuildComp(e);
				break;
			case 'buildWire':
				this.startBuildWire(e);
				break;
			case 'connectWire':
				this.toggleWireConn(e);
				break;
			case 'text':
				this.placeText(e);
				break;
			case 'select':
				this.startSelection(e);
				break;
		}
	}

	private pUpView(e: InteractionEvent) {
		switch (this._state) {
			case ViewIntManState.NEW_COMP:
				this.buildNewComp(e);
				break;
			case ViewIntManState.SELECT:
				this.selectFromRect(e);
				break;
			case ViewIntManState.DRAGGING:
				this.applyDrag(e);
				break;
			case ViewIntManState.NEW_WIRE:
				this.buildNewWire(e);
				break;
		}
	}

	private pMoveView(e: InteractionEvent) {
		switch (this._state) {
			case ViewIntManState.NEW_COMP:
			case ViewIntManState.DRAGGING:
				this.dragSelection(e);
				break;
			case ViewIntManState.SELECT:
				this.dragSelectRect(e);
				break;
			case ViewIntManState.NEW_WIRE:
				this.dragNewWire(e);
				break;
		}
	}

	private pDownSelectRect(e: InteractionEvent) {
		if (this._state === ViewIntManState.WAIT_FOR_DRAG) {
			this._state = ViewIntManState.DRAGGING;
			if (!this._actionPos) {
				this._actionPos = new PosHelper(e, this._view, (this._selectedElements[0].position as PIXI.ObservablePoint).clone());
			} else {
				this._actionPos.addDragPos(e, this._view);
			}
		}
	}

	private pUpElement(e: InteractionEvent, lGraphics: LGraphics) {
		if (this.workModeSer.currentWorkMode === 'buildComponent' || this._state === ViewIntManState.DRAGGING || this._selectRect.visible) return;
		this.cleanUp();
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

	private pDownElement(e: InteractionEvent, lGraphics: LGraphics) {
		if (this._state === ViewIntManState.WAIT_FOR_DRAG && !this._selectRect.visible && this._selectedElements.includes(lGraphics)) {
			this._state = ViewIntManState.DRAGGING;
			if (!this._actionPos) this._actionPos = new PosHelper(e, this._view, (lGraphics.position as PIXI.ObservablePoint).clone());
		}
	}

	private startBuildComp(e: InteractionEvent) {
		const typeId = this.workModeSer.currentComponentToBuild;
		const elemType = this.elemProvSer.getElementById(typeId);
		if (elemType.numInputs === 0 && elemType.numOutputs === 0) return;
		this._state = ViewIntManState.NEW_COMP;
		this._actionPos = new PosHelper(e, this._view);
		const newElem = LGraphicsResolver.getLGraphicsFromType(this.currScale, typeId);
		newElem.position = this._actionPos.pixelPosOnGridStart;
		this._view.addChild(newElem);
		this._selectedElements = [newElem];
		this._selectionNewElements = true;
		this._view.requestSingleFrame();
	}

	private startBuildWire(e: InteractionEvent) {
		this._state = ViewIntManState.NEW_WIRE;
		this._actionPos = new PosHelper(e, this._view);
		this._wireGraphics.position = this._actionPos.pixelPosOnGridStartWire;
		this._wireGraphics.visible = true;
	}

	private dragNewWire(e) {
		this._actionPos.addDragPos(e, this._view);
		if (this._wireDirection === undefined
			&& CollisionFunctions.distance(this._actionPos.gridPosStart, this._actionPos.lastGridPosDrag) >= 1
		) {
			if (this._actionPos.gridPosStart.x === this._actionPos.lastGridPosDrag.x) {
				this._wireDirection = WireDir.VER;
			} else if (this._actionPos.gridPosStart.y === this._actionPos.lastGridPosDrag.y) {
				this._wireDirection = WireDir.HOR;
			} else {
				this._wireDirection = WireDir.VER;
			}
		}
		this._wireGraphics.clear();
		this._wireGraphics.lineStyle(1 / this._view.zoomPan.currentScale, this.themingSer.getEditorColor('wire'));
		this._wireGraphics.moveTo(0, 0);
		const endPosAbsolute = this._actionPos.lastPixelPosOnGridWire;
		const endPosRel = new PIXI.Point(
			endPosAbsolute.x - this._actionPos.pixelPosOnGridStartWire.x, endPosAbsolute.y - this._actionPos.pixelPosOnGridStartWire.y
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

	private buildNewWire(e: InteractionEvent) {
		const startPos = this._actionPos.gridPosStart;
		const endPos = this._actionPos.lastGridPosDrag;
		this.projectsSer.currProject.addWire(
			startPos,
			this._wireDirection === WireDir.HOR ? new PIXI.Point(endPos.x, startPos.y) : new PIXI.Point(startPos.x, endPos.y),
			endPos
		);
		this.cleanUp();
	}

	private startSelection(e: InteractionEvent) {
		this._state = ViewIntManState.SELECT;
		this._actionPos = new PosHelper(e, this._view);
		this._selectRect.width = 0;
		this._selectRect.height = 0;
		this._selectRect.position = this._actionPos.pixelPosStartDrag;
		this._selectRect.visible = true;
	}

	private dragSelectRect(e: InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		const selSize = this._actionPos.getPixelPosDiffFromStart();
		this._selectRect.width = selSize.x;
		this._selectRect.height = selSize.y;
		this._view.requestSingleFrame();
	}

	private selectFromRect(e: InteractionEvent) {
		const selected = this.selectionSer.selectFromRect(
			this.projectsSer.currProject, this._actionPos.gridPosFloatStart, this._actionPos.lastGridPosFloat
		);
		if (selected.length === 0) {
			this.cleanUp();
			return;
		}
		this._selectedElements = selected.map(selId => {
			const lGraphics = this._view.allElements.get(selId);
			lGraphics.setSelected(true);
			lGraphics.parent.removeChild(lGraphics);
			this._view.addChild(lGraphics);
			if (lGraphics.element.typeId === ElementTypeId.WIRE) {
				lGraphics.position = Grid.getPixelPosForGridPosWire(lGraphics.element.pos);
			} else {
				lGraphics.position = Grid.getPixelPosForGridPos(lGraphics.element.pos);
			}
			return lGraphics;
		});
		this._selectedConnPoints = this.selectionSer.selectedConnections().map(point => {
			const graphics = this._view.connectionPoints.get(`${point.x}:${point.y}`);
			graphics.tint = this.themingSer.getEditorColor('selectTint');
			graphics.parent.removeChild(graphics);
			this._view.addChild(graphics);
			this._view.drawConnectionPoint(graphics, Grid.getPixelPosForGridPosWire(point));
			return {graphics, pos: point};
		});
		this._selectionNewElements = false;
		delete this._actionPos;
		this._state = ViewIntManState.WAIT_FOR_DRAG;
		this._view.requestSingleFrame();
	}

	private buildNewComp(e: InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		this.projectsSer.currProject.addElement(this.workModeSer.currentComponentToBuild, this._actionPos.lastGridPosDrag);
		this.cleanUp();
	}

	private dragSelection(e: InteractionEvent) {
		const diff = this._actionPos.addDragPos(e, this._view);
		for (const lGraphics of this._selectedElements) {
			lGraphics.position.x += diff.x;
			lGraphics.position.y += diff.y;
		}
		for (const connPoint of this._selectedConnPoints || []) {
			connPoint.graphics.x += diff.x;
			connPoint.graphics.y += diff.y;
		}
		if (this._selectRect.visible) {
			this._selectRect.x += diff.x;
			this._selectRect.y += diff.y;
		}
		this._view.requestSingleFrame();
	}

	private applyDrag(e: InteractionEvent) {
		if (this.projectsSer.currProject.moveElementsById(
			this.selectionSer.selectedIds(), this._actionPos.getGridPosDiffFromStart(this._selectedElements[0].position))
		) {
			this.cleanUp();
		} else {
			this._state = ViewIntManState.WAIT_FOR_DRAG;
		}
	}

	private placeText(e: InteractionEvent) {
		const pos = Grid.getGridPosForPixelPos(e.data.getLocalPosition(this._view));
		getStaticDI(NgZone).run(async () => {
			const text = await getStaticDI(PopupService).showPopup(TextComponent, 'POPUP.TEXT.TITLE', false);
			if (!text) return;
			this.projectsSer.currProject.addText(text, pos);
		});
		this.cleanUp();
	}

	private toggleWireConn(e: InteractionEvent) {
		this._actionPos = new PosHelper(e, this._view);
		this.projectsSer.currProject.toggleWireConnection(this._actionPos.gridPosStart);
		this.cleanUp();
	}

	private get currScale() {
		return this._view.zoomPan.currentScale;
	}

	private cleanUp() {
		this._state = ViewIntManState.IDLE;
		this.selectionSer.clearSelection();
		for (const lGraphics of this._selectedElements || []) {
			try {
				if (this._selectionNewElements) {
					lGraphics.destroy();
				} else {
					this._view.addToCorrectChunk(lGraphics, lGraphics.element.pos);
					this._view.setLocalChunkPos(lGraphics.element, lGraphics);
					lGraphics.setSelected(false);
				}
			} catch {}
		}
		for (const point of this._selectedConnPoints || []) {
			try {
				if (this._selectionNewElements) {
					point.graphics.destroy();
				} else {
					this._view.removeChild(point.graphics);
					this._view.addToCorrectChunk(point.graphics, point.pos);
					point.graphics.tint = 0xFFFFFF;
					this._view.drawConnectionPoint(point.graphics, Grid.getLocalChunkPixelPosForGridPosWire(point.pos));
				}
			} catch {}

		}
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

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.complete();
	}

}
