import * as PIXI from 'pixi.js';
import {Grid} from './grid';
import {ProjectsService} from '../../services/projects/projects.service';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {ViewInteractionManager} from './view-interaction-manager';
import {Action} from '../action';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter, takeUntil} from 'rxjs/operators';
import {SelectionService} from '../../services/selection/selection.service';
import {RenderTicker} from './render-ticker';
import {View} from './view';
import {Project} from '../project';
import {Element} from '../element';
import {ElementSprite} from '../element-sprite';
import {ProjectType} from '../project-type';

export class EditorView extends View {

	private _viewInteractionManager: ViewInteractionManager;

	constructor(project: Project, htmlContainer: HTMLElement, ticker: RenderTicker) {
		super(project, htmlContainer, ticker);

		this._viewInteractionManager = new ViewInteractionManager(this);

		this.applyOpenActions();

		ProjectsService.staticInstance.onProjectChanges$(this.projectId).pipe(
			takeUntil(this._destroySubject)
		).subscribe((actions: Action[]) => this.applyActionsToView(actions));

		ProjectInteractionService.staticInstance.onZoomChangeClick$.pipe(
			filter(_ => this.projectId === ProjectsService.staticInstance.currProject.id),
			takeUntil(this._destroySubject)
		).subscribe((dir => this.onZoomClick(dir)));
	}

	public updateSelectedElementsScale() {
		const selectedIds = SelectionService.staticInstance.selectedIds(this.projectId);
		for (let i = 0; i < selectedIds.length; i++) {
			const elemSprite = this.allElements.get(selectedIds[i]);
			if (elemSprite.element.typeId === 0) {
				this.updateWireSprite(elemSprite.element, elemSprite.sprite as PIXI.Graphics);
			} else if (elemSprite) {
				this.updateComponentSprite(elemSprite.element, elemSprite.sprite as PIXI.Graphics);
			}
		}
		const selectedConnections = SelectionService.staticInstance.selectedConnections(this.projectId);
		for (let i = 0; i < selectedConnections.length; i++) {
			const graphics = this.connectionPoints.get(`${selectedConnections[i].x}:${selectedConnections[i].y}`);
			const pos = Grid.getPixelPosForPixelPosOnGridWire(graphics.position);
			this.drawConnectionPoint(graphics, pos);
		}
	}

	public updatePastingElementsScale() {
		for (const elemSprite of this._viewInteractionManager.pastingElements) {
			if (elemSprite.element.typeId === 0) {
				this.updateWireSprite(elemSprite.element, elemSprite.sprite as PIXI.Graphics);
			} else {
				this.updateComponentSprite(elemSprite.element, elemSprite.sprite as PIXI.Graphics);
			}
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
		const type = ElementProviderService.staticInstance.getElementById(typeId);
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
		super.destroy();
		this._viewInteractionManager.destroy();
	}

}
