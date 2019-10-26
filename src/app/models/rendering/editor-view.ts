import * as PIXI from 'pixi.js';
import {Grid} from './grid';
import {ProjectsService} from '../../services/projects/projects.service';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ViewInteractionManager} from './view-interaction-manager';
import {Action} from '../action';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter, takeUntil} from 'rxjs/operators';
import {SelectionService} from '../../services/selection/selection.service';
import {View} from './view';
import {Project} from '../project';
import {Element} from '../element';
import {ElementSprite} from '../element-sprite';
import {ProjectType} from '../project-type';
import {getStaticDI} from '../get-di';

export class EditorView extends View {

	private _viewInteractionManager: ViewInteractionManager;

	private selectionService = getStaticDI(SelectionService);

	constructor(project: Project, htmlContainer: HTMLElement, requestSingleFrameFn: () => void) {
		super(project, htmlContainer, requestSingleFrameFn);

		this._viewInteractionManager = new ViewInteractionManager(this);

		this.applyOpenActions();

		getStaticDI(ProjectsService).onProjectChanges$(this.projectId).pipe(
			takeUntil(this._destroySubject)
		).subscribe((actions: Action[]) => this.applyActionsToView(actions));

		getStaticDI(ProjectInteractionService).onZoomChangeClick$.pipe(
			filter(_ => this.projectId === getStaticDI(ProjectsService).currProject.id),
			takeUntil(this._destroySubject)
		).subscribe((dir => this.onZoomClick(dir)));
	}

	public updateSelectedElementsScale() {
		const selectedIds = this.selectionService.selectedIds(this.projectId);
		for (let i = 0; i < selectedIds.length; i++) {
			this.allElements.get(selectedIds[i]).sprite.updateScale(this.zoomPan.currentScale);
		}
		const selectedConnections = this.selectionService.selectedConnections(this.projectId);
		for (let i = 0; i < selectedConnections.length; i++) {
			const graphics = this.connectionPoints.get(`${selectedConnections[i].x}:${selectedConnections[i].y}`);
			const pos = Grid.getPixelPosForPixelPosOnGridWire(graphics.position);
			this.drawConnectionPoint(graphics, pos);
		}
	}

	public updatePastingElementsScale() {
		for (const elemSprite of this._viewInteractionManager.pastingElements) {
			elemSprite.sprite.updateScale(this.zoomPan.currentScale);
		}
		for (const graphics of this._viewInteractionManager.pastingConnPoints) {
			const pos = Grid.getPixelPosForPixelPosOnGridWire(graphics.position);
			this.drawConnectionPoint(graphics, pos);
		}
	}

	public placeWires(start: PIXI.Point, middle: PIXI.Point, end?: PIXI.Point) {
		this._project.addWire(start, middle, end);
	}

	public placeComponent(position: PIXI.Point, typeId: number) {
		const type = getStaticDI(ElementProviderService).getElementById(typeId);
		return this._project.addElement(typeId, type.rotation, type.numInputs, type.numOutputs, position);
	}

	public placeComponentOnView(element: Element): ElementSprite {
		const es = super.placeComponentOnView(element);
		this._viewInteractionManager.addEventListenersToNewElement(es);
		return es;
	}

	public get projectType(): ProjectType {
		return this._project.type;
	}

	public destroy() {
		this._viewInteractionManager.destroy();
		super.destroy();
	}

}
