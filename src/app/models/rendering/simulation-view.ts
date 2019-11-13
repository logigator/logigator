import {View} from './view';
import {Project} from '../project';
import {Element} from '../element';
import {SimulationViewInteractionManager} from './simulation-view-interaction-manager';
import {EventEmitter, NgZone} from '@angular/core';
import {ReqInspectElementEvent} from './req-inspect-element-event';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter, takeUntil} from 'rxjs/operators';
import {getStaticDI} from '../get-di';
import {WorkerCommunicationService} from '../../services/simulation/worker-communication/worker-communication.service';
import {LGraphicsResolver} from './graphics/l-graphics-resolver';
import {Grid} from './grid';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';

export class SimulationView extends View {

	private _simViewInteractionManager: SimulationViewInteractionManager;

	public requestInspectElemEventEmitter: EventEmitter<ReqInspectElementEvent>;

	public parentProjectIdentifier: string;
	public parentProjectNames: string[];
	public parentTypeIds: number[];

	constructor(
		project: Project,
		htmlContainer: HTMLElement,
		requestSingleFrameFn: () => Promise<void>,
		requestInspectElemEventEmitter: EventEmitter<ReqInspectElementEvent>,
		parent: string,
		parentNames: string[],
		parentTypeIds: number[]
	) {
		super(project, htmlContainer, requestSingleFrameFn);
		this.requestInspectElemEventEmitter = requestInspectElemEventEmitter;
		this.parentProjectIdentifier = parent;
		this.parentProjectNames = parentNames;
		this.parentTypeIds = parentTypeIds;
		this._simViewInteractionManager = new SimulationViewInteractionManager(this);
		this.applyOpenActions();

		getStaticDI(NgZone).runOutsideAngular(async () => {
			getStaticDI(ProjectInteractionService).onZoomChangeClick$.pipe(
				filter(_ => this._project.type === 'project'),
				takeUntil(this._destroySubject)
			).subscribe((dir => this.onZoomClick(dir)));

			getStaticDI(WorkerCommunicationService).subscribe(this.parentProjectIdentifier);
			getStaticDI(WorkerCommunicationService).boardStateWires(this.parentProjectIdentifier).pipe(
				takeUntil(this._destroySubject)
			).subscribe(e => this.blinkWires(e));
			getStaticDI(WorkerCommunicationService).boardStateWireEnds(this.parentProjectIdentifier).pipe(
				takeUntil(this._destroySubject)
			).subscribe(e => this.blinkComps(e));

			if (project.type === 'comp') {
				await this.requestSingleFrame();
				this.blinkWires(getStaticDI(WorkerCommunicationService).getWireState(this.parentProjectIdentifier));
				this.blinkComps(getStaticDI(WorkerCommunicationService).getWireEndState(this.parentProjectIdentifier));
			}
		});
	}

	isSimulationView(): boolean {
		return true;
	}

	public placeComponentOnView(element: Element) {
		const sprite = LGraphicsResolver.getLGraphicsFromElement(this.zoomPan.currentScale, element, this.parentProjectIdentifier);
		sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);
		sprite.name = element.id.toString();
		this.addToCorrectChunk(sprite, element.pos);
		this.allElements.set(element.id, sprite);
		if (getStaticDI(ElementProviderService).isUserElement(element.typeId)) {
			this._simViewInteractionManager.addEventListenersToCustomElement(sprite);
		}
	}

	private blinkWires(e: Map<Element, boolean>) {
		for (const [elem, state] of e) {
			this.allElements.get(elem.id).setSimulationState([state]);
		}
		this.requestSingleFrame();
	}

	private blinkComps(e: Map<Element, boolean[]>) {
		for (const [elem, value] of e.entries()) {
			this.allElements.get(elem.id).setSimulationState(value);
		}
		this.requestSingleFrame();
	}

	public get projectName(): string {
		return this._project.name;
	}

	public destroy() {
		super.destroy();
		getStaticDI(WorkerCommunicationService).unsubscribe(this.parentProjectIdentifier);
	}
}
