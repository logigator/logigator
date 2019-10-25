import {View} from './view';
import {Project} from '../project';
import {RenderTicker} from './render-ticker';
import {Element} from '../element';
import {ElementSprite} from '../element-sprite';
import {SimulationViewInteractionManager} from './simulation-view-interaction-manager';
import {EventEmitter} from '@angular/core';
import {ReqInspectElementEvent} from './req-inspect-element-event';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter, takeUntil} from 'rxjs/operators';
import {ProjectsService} from '../../services/projects/projects.service';
import {getStaticDI} from '../get-di';
import {WorkerCommunicationService} from '../../services/simulation/worker-communication/worker-communication.service';

export class SimulationView extends View {

	private _simViewInteractionManager: SimulationViewInteractionManager;

	public requestInspectElemEventEmitter: EventEmitter<ReqInspectElementEvent>;

	public parentProjectIdentifier: string;
	public parentProjectNames: string[];
	public parentTypeIds: number[];

	constructor(
		project: Project,
		htmlContainer: HTMLElement,
		ticker: RenderTicker,
		requestInspectElemEventEmitter: EventEmitter<ReqInspectElementEvent>,
		parent: string,
		parentNames: string[],
		parentTypeIds: number[]
	) {
		super(project, htmlContainer, ticker);
		this.requestInspectElemEventEmitter = requestInspectElemEventEmitter;
		this.parentProjectIdentifier = parent;
		this.parentProjectNames = parentNames;
		this.parentTypeIds = parentTypeIds;
		this._simViewInteractionManager = new SimulationViewInteractionManager(this);
		this.applyOpenActions();

		getStaticDI(ProjectInteractionService).onZoomChangeClick$.pipe(
			filter(_ => this._project.type === 'project'),
			takeUntil(this._destroySubject)
		).subscribe((dir => this.onZoomClick(dir)));

		getStaticDI(WorkerCommunicationService).subscribe(this.parentProjectIdentifier);
		getStaticDI(WorkerCommunicationService).boardStateWires(this.parentProjectIdentifier).pipe(
			takeUntil(this._destroySubject)
		).subscribe(e => this.blinkWires(e));
	}

	public placeComponentOnView(element: Element): ElementSprite {
		const es = super.placeComponentOnView(element);
		this._simViewInteractionManager.addEventListenersToNewElement(es);
		return es;
	}

	private blinkWires(e: Map<Element, boolean>) {
		for (const [elem, state] of e) {
			this.allElements.get(elem.id).sprite.setWireState(this.zoomPan.currentScale, state);
		}
		this.ticker.singleFrame();
	}

	public get projectName(): string {
		return this._project.name;
	}
}
