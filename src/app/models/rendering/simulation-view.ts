import {View} from './view';
import {Project} from '../project';
import {RenderTicker} from './render-ticker';
import {Element} from '../element';
import {ElementSprite} from '../element-sprite';
import {SimulationViewInteractionManager} from './simulation-view-interaction-manager';
import {EventEmitter} from '@angular/core';
import {ReqInspectElementEvent} from './req-inspect-element-event';

export class SimulationView extends View {

	private _simViewInteractionManager: SimulationViewInteractionManager;

	public requestInspectElemEventEmitter: EventEmitter<ReqInspectElementEvent>;

	public parentProjectIdentifier: string;

	constructor(
		project: Project,
		htmlContainer: HTMLElement,
		ticker: RenderTicker,
		requestInspectElemEventEmitter: EventEmitter<ReqInspectElementEvent>,
		parent: string
	) {
		super(project, htmlContainer, ticker);
		this.requestInspectElemEventEmitter = requestInspectElemEventEmitter;
		this.parentProjectIdentifier = parent;
		this._simViewInteractionManager = new SimulationViewInteractionManager(this);
		this.applyOpenActions();
	}

	public placeComponentOnView(element: Element): ElementSprite {
		const es = super.placeComponentOnView(element);
		this._simViewInteractionManager.addEventListenersToNewElement(es);
		return es;
	}
}
