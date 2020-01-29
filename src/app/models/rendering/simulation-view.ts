import {View} from './view';
import {Project} from '../project';
import {Element} from '../element';
import {SimulationViewInteractionManager} from './simulation-view-interaction-manager';
import {EventEmitter, NgZone} from '@angular/core';
import {ReqInspectElementEvent} from './req-inspect-element-event';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter, takeUntil} from 'rxjs/operators';
import {getStaticDI} from '../get-di';
import {LGraphicsResolver} from './graphics/l-graphics-resolver';
import {Grid} from './grid';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {WorkerCommunicationService} from '../../services/simulation/worker-communication/worker-communication-service';
import {isResetable} from './graphics/l-graphics';

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

			const workerCommunicationService = getStaticDI(WorkerCommunicationService);

			workerCommunicationService.subscribe(this.parentProjectIdentifier);
			workerCommunicationService.boardStateWires(this.parentProjectIdentifier).pipe(
				takeUntil(this._destroySubject)
			).subscribe(e => this.blinkWires(e));
			workerCommunicationService.boardStateWireEnds(this.parentProjectIdentifier).pipe(
				takeUntil(this._destroySubject)
			).subscribe(e => this.blinkComps(e));
			workerCommunicationService.onIoCompReset(this.parentProjectIdentifier).pipe(
				takeUntil(this._destroySubject)
			).subscribe(() => this.resetIoComps())

			if (project.type === 'comp') {
				await this.requestSingleFrame();
				this.blinkWires(workerCommunicationService.getWireState(this.parentProjectIdentifier));
				this.blinkComps(workerCommunicationService.getWireEndState(this.parentProjectIdentifier));
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

	private resetIoComps() {
		for (const element of this.allElements.values()) {
			if (isResetable(element)) {
				element.resetSimState();
			}
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
