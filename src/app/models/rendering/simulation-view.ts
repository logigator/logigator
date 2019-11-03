import {View} from './view';
import {Project} from '../project';
import {Element} from '../element';
import {ElementSprite} from '../element-sprite';
import {SimulationViewInteractionManager} from './simulation-view-interaction-manager';
import {EventEmitter, NgZone} from '@angular/core';
import {ReqInspectElementEvent} from './req-inspect-element-event';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter, takeUntil, tap} from 'rxjs/operators';
import {getStaticDI} from '../get-di';
import {WorkerCommunicationService} from '../../services/simulation/worker-communication/worker-communication.service';
import {WireGraphics} from './wire-graphics';
import {ComponentGraphics} from './component-graphics';

export class SimulationView extends View {

	private _simViewInteractionManager: SimulationViewInteractionManager;

	public requestInspectElemEventEmitter: EventEmitter<ReqInspectElementEvent>;

	public parentProjectIdentifier: string;
	public parentProjectNames: string[];
	public parentTypeIds: number[];

	constructor(
		project: Project,
		htmlContainer: HTMLElement,
		requestSingleFrameFn: () => void,
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

		getStaticDI(NgZone).runOutsideAngular(() => {
			getStaticDI(ProjectInteractionService).onZoomChangeClick$.pipe(
				filter(_ => this._project.type === 'project'),
				takeUntil(this._destroySubject)
			).subscribe((dir => this.onZoomClick(dir)));

			getStaticDI(WorkerCommunicationService).subscribe(this.parentProjectIdentifier);
			getStaticDI(WorkerCommunicationService).boardStateWires(this.parentProjectIdentifier).pipe(
				takeUntil(this._destroySubject),
			).subscribe(e => this.blinkWires(e));
			getStaticDI(WorkerCommunicationService).boardStateWireEnds(this.parentProjectIdentifier).pipe(
				takeUntil(this._destroySubject)
			).subscribe(e => this.blinkComps(e));

			if (project.type === 'comp') {
				this.blinkWires(getStaticDI(WorkerCommunicationService).getState(this.parentProjectIdentifier));
			}
		});
	}

	public placeComponentOnView(element: Element): ElementSprite {
		const es = super.placeComponentOnView(element);
		this._simViewInteractionManager.addEventListenersToNewElement(es);
		return es;
	}

	private blinkWires(e: Map<Element, boolean>) {
		for (const [elem, state] of e) {
			(this.allElements.get(elem.id).sprite as WireGraphics).setWireState(state);
		}
		for (const elem of this.allElements.values()) {
			if (elem.sprite instanceof ComponentGraphics) {
				elem.sprite.setSimulationSate([true, false, true]);
			}
		}
		this.requestSingleFrame();
	}

	private blinkComps(e: Map<{component: Element, wireIndex: number}, boolean>) {
		for (const [elem] of e) {
			(this.allElements.get(elem.component.id).sprite as ComponentGraphics).setSimulationSate([true, false, true]);
		}
	}

	public get projectName(): string {
		return this._project.name;
	}

	public destroy() {
		super.destroy();
		getStaticDI(WorkerCommunicationService).unsubscribe(this.parentProjectIdentifier);
	}
}
