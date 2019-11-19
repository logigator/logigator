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
import {CleanUpMethod, ViewIntManState} from './view-int-man-states';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {LGraphicsResolver} from './graphics/l-graphics-resolver';
import {PosHelper} from './view-int-man-helpers';
import {ProjectsService} from '../../services/projects/projects.service';
import {SelectionService} from '../../services/selection/selection.service';
import {ElementTypeId} from '../element-types/element-type-ids';
import {Grid} from './grid';
import InteractionEvent = PIXI.interaction.InteractionEvent;

export class ViewInteractionManager {

	private readonly _view: EditorView;

	private _destroySubject = new Subject<void>();

	private _selectRect: PIXI.Graphics;

	private _selectedElements: LGraphics[];
	private _selectedConnPoints: PIXI.Graphics[];

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

		this.initEventListeners();

		merge(this.workModeSer.currentWorkMode$, getStaticDI(ProjectInteractionService).onElementsDelete$)
			.pipe(takeUntil(this._destroySubject)).subscribe(() => this.cleanUp(CleanUpMethod.RESET_SEL));
	}

	public addNewElement(lGraphics: LGraphics) {
		getStaticDI(NgZone).runOutsideAngular(() => {
			lGraphics.interactive = true;
			lGraphics.on('pointerup', (e: InteractionEvent) => this.pUpElement(e, lGraphics));
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

	private pDownView(e: InteractionEvent) {
		if (e.target !== this._view || e.data.button !== 0) return;
		if (this._state === ViewIntManState.WAIT_FOR_DRAG) {
			this.cleanUp(CleanUpMethod.RESET_SEL);
		}
		switch (this.workModeSer.currentWorkMode) {
			case 'buildComponent':
				this.startBuildComp(e);
				break;
			case 'buildWire':
				break;
			case 'connectWire':
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
		}
	}

	private pDownSelectRect(e: InteractionEvent) {
		if (this._state === ViewIntManState.WAIT_FOR_DRAG) {
			this._state = ViewIntManState.DRAGGING;
			if (!this._actionPos) this._actionPos = new PosHelper(e, this._view);
		}
	}

	private pUpElement(e: InteractionEvent, lGraphics: LGraphics) {
		if (this.workModeSer.currentWorkMode === 'buildComponent') return;
		this.cleanUp(CleanUpMethod.DESELECT);
		this._state = ViewIntManState.WAIT_FOR_DRAG;
		this.selectionSer.selectComponent(lGraphics.element.id);
		lGraphics.setSelected(true);
		lGraphics.parent.removeChild(lGraphics);
		lGraphics.position = Grid.getPixelPosForGridPos(lGraphics.element.pos);
		this._view.addChild(lGraphics);
		this._selectedElements = [lGraphics];
		this._view.requestSingleFrame();
	}

	private startBuildComp(e: InteractionEvent) {
		this.cleanUp(CleanUpMethod.DESELECT);
		const typeId = this.workModeSer.currentComponentToBuild;
		const elemType = this.elemProvSer.getElementById(typeId);
		if (elemType.numInputs === 0 && elemType.numOutputs === 0) return;
		this._state = ViewIntManState.NEW_COMP;
		this._actionPos = new PosHelper(e, this._view);
		const newElem = LGraphicsResolver.getLGraphicsFromType(this.currScale, typeId);
		newElem.position = this._actionPos.pixelPosOnGridStart;
		this._view.addChild(newElem);
		this._selectedElements = [newElem];
		this._view.requestSingleFrame();
	}

	private startSelection(e: InteractionEvent) {
		this.cleanUp(CleanUpMethod.RESET_SEL);
		this._state = ViewIntManState.SELECT;
		this._actionPos = new PosHelper(e, this._view);
		this._selectRect.width = 0;
		this._selectRect.height = 0;
		this._selectRect.position = this._actionPos.pixelPosStart;
		this._selectRect.visible = true;
	}

	private dragSelectRect(e: InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		const selSize = this._actionPos.pixelPosDiffFromStart;
		this._selectRect.width = selSize.x;
		this._selectRect.height = selSize.y;
		this._view.requestSingleFrame();
	}

	private selectFromRect(e: InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		const selected = this.selectionSer.selectFromRect(
			this.projectsSer.currProject, this._actionPos.gridPosFloatStart, this._actionPos.lastGridPosFloat
		);
		if (selected.length === 0) {
			this.cleanUp(CleanUpMethod.DESELECT);
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
			const element = this._view.connectionPoints.get(`${point.x}:${point.y}`);
			element.tint = this.themingSer.getEditorColor('selectTint');
			element.parent.removeChild(element);
			this._view.addChild(element);
			const pos = Grid.getPixelPosForGridPosWire(point);
			const size = this._view.calcConnPointSize();
			element.position = this._view.adjustConnPointPosToSize(pos, size);
			return element;
		});
		this.cleanUp(CleanUpMethod.NONE);
		this._state = ViewIntManState.WAIT_FOR_DRAG;
	}

	private buildNewComp(e: InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		this.projectsSer.currProject.addElement(this.workModeSer.currentComponentToBuild, this._actionPos.lastGridPos);
		this.cleanUp(CleanUpMethod.REMOVE);
	}

	private dragSelection(e: InteractionEvent) {
		const diff = this._actionPos.addDragPos(e, this._view);
		for (const lGraphics of this._selectedElements) {
			lGraphics.position.x += diff.x;
			lGraphics.position.y += diff.y;
		}
		for (const connPoint of this._selectedConnPoints || []) {
			connPoint.position.x += diff.x;
			connPoint.position.y += diff.y;
		}
		if (this._selectRect.visible) {
			this._selectRect.x += diff.x;
			this._selectRect.y += diff.y;
		}
		this._view.requestSingleFrame();
	}

	private applyDrag(e: InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		if (this.projectsSer.currProject.moveElementsById(this.selectionSer.selectedIds(), this._actionPos.gridPosDifFFromStart)) {
			this.cleanUp(CleanUpMethod.DESELECT);
		} else {
			this._state = ViewIntManState.WAIT_FOR_DRAG;
		}
	}

	private get currScale() {
		return this._view.zoomPan.currentScale;
	}

	private cleanUp(method: CleanUpMethod) {
		this._state = ViewIntManState.IDLE;
		switch (method) {
			case CleanUpMethod.REMOVE:
				for (const lGraphics of this._selectedElements) {
					lGraphics.destroy();
				}
				for (const point of this._selectedConnPoints) {
					point.destroy();
				}
				break;
			case CleanUpMethod.RESET_SEL:
				for (const lGraphics of this._selectedElements) {
					this._view.removeChild(lGraphics);
					this._view.addToCorrectChunk(lGraphics, lGraphics.element.pos);
					this._view.setLocalChunkPos(lGraphics.element, lGraphics);
				}
				for (const point of this.selectionSer.selectedConnections()) {
					const key = `${point.x}:${point.y}`;
					if (!this._view.connectionPoints.has(key)) return;
					const sprite = this._view.connectionPoints.get(key);
					this._view.removeChild(sprite);
					this._view.addToCorrectChunk(sprite, point);
					const pos = Grid.getLocalChunkPixelPosForGridPosWireStart(point);
					const size = this._view.calcConnPointSize();
					sprite.position = this._view.adjustConnPointPosToSize(pos, size);
				}
				break;
		}
		if (method !== CleanUpMethod.NONE) {
			this._selectRect.visible = false;
			for (const lGraphics of this._selectedElements || []) {
				lGraphics.setSelected(false);
			}
			for (const point of this._selectedConnPoints || []) {
				const element = this._view.connectionPoints.get(`${point.x}:${point.y}`);
				element.tint = this.themingSer.getEditorColor('wire');
			}
			this._selectedElements = [];
		}
		delete this._actionPos;
		this._view.requestSingleFrame();
	}

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.complete();
	}

}
