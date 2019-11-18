import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {EditorView} from './editor-view';
import {merge, Subject} from 'rxjs';
import {LGraphics} from './graphics/l-graphics';
import {getStaticDI} from '../get-di';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {takeUntil} from 'rxjs/operators';
import {NgZone} from '@angular/core';
import {ThemingService} from '../../services/theming/theming.service';
import {ViewIntManState} from './view-int-man-states';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {LGraphicsResolver} from './graphics/l-graphics-resolver';
import {PosHelper} from './view-int-man-helpers';
import {ProjectsService} from '../../services/projects/projects.service';

export class ViewInteractionManager {

	private readonly _view: EditorView;

	private _destroySubject = new Subject<void>();

	private _selectRect: PIXI.Graphics;

	private _selectedElements: LGraphics[];

	private _actionPos: PosHelper;

	private _state: ViewIntManState = ViewIntManState.IDLE;

	private workModeService = getStaticDI(WorkModeService);
	private themingService = getStaticDI(ThemingService);
	private elemProvService = getStaticDI(ElementProviderService);
	private projects = getStaticDI(ProjectsService);

	constructor(view: EditorView) {
		this._view = view;

		this._selectRect = new PIXI.Graphics();
		this._selectRect.beginFill(this.themingService.getEditorColor('selectRect'), 0.3);
		this._selectRect.drawRect(0, 0, 1, 1);
		this._selectRect.interactive = true;
		this._selectRect.zIndex = 10;

		this.initEventListeners();

		merge(this.workModeService.currentWorkMode$, getStaticDI(ProjectInteractionService).onElementsDelete$)
			.pipe(takeUntil(this._destroySubject)).subscribe(() => this.resetSelection());
	}

	public addNewElement(lGraphics: LGraphics) {

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
		switch (this.workModeService.currentWorkMode) {
			case 'buildComponent':
				this.startBuildComp(e);
				break;
			case 'buildWire':
				break;
			case 'connectWire':
				break;
			case 'select':
				break;
		}
	}

	private pUpView(e: InteractionEvent) {
		switch (this._state) {
			case ViewIntManState.NEW_COMP:
				this.buildNewComp(e);
				break;
		}
	}

	private pMoveView(e: InteractionEvent) {
		switch (this._state) {
			case ViewIntManState.NEW_COMP:
			case ViewIntManState.DRAGGING:
				this.dragSelection(e);
				break;
		}
	}

	private pDownSelectRect(e: InteractionEvent) {

	}

	private startBuildComp(e: InteractionEvent) {
		this.resetSelection();
		const typeId = this.workModeService.currentComponentToBuild;
		const elemType = this.elemProvService.getElementById(typeId);
		if (elemType.numInputs === 0 && elemType.numOutputs === 0) return;
		this._state = ViewIntManState.NEW_COMP;
		this._actionPos = new PosHelper(e, this._view);
		const newElem = LGraphicsResolver.getLGraphicsFromType(this.currScale, typeId);
		newElem.position = this._actionPos.pixelPosOnGridStart;
		this._view.addChild(newElem);
		this._selectedElements = [newElem];
		this._view.requestSingleFrame();
	}

	private buildNewComp(e: InteractionEvent) {
		this._actionPos.addDragPos(e, this._view);
		this.projects.currProject.addElement(this.workModeService.currentComponentToBuild, this._actionPos.lastGridPos);
		this.cleanUp();
	}

	private dragSelection(e: InteractionEvent) {
		const diff = this._actionPos.addDragPos(e, this._view);
		for (const lGraphics of this._selectedElements) {
			lGraphics.position.x += diff.x;
			lGraphics.position.y += diff.y;
		}
		this._view.requestSingleFrame();
	}

	private get currScale() {
		return this._view.zoomPan.currentScale;
	}

	private resetSelection() {
		this._state = ViewIntManState.IDLE;
		this._view.requestSingleFrame();
		// check if element is in all elememts if not remove
		// reset selection to old pos + hide selectrect
	}

	private cleanUp() {
		this._state = ViewIntManState.IDLE;
		for (const lGraphics of this._selectedElements) {
			lGraphics.destroy();
		}
		this._selectedElements = [];
		this._view.requestSingleFrame();
	}

	public destroy() {
		this._destroySubject.next();
		this._destroySubject.complete();
	}

}
