import {View} from './view';
import {Project} from '../project';
import {RenderTicker} from './render-ticker';
import {Element} from '../element';
import {ElementSprite} from '../element-sprite';
import {SimulationViewInteractionManager} from './simulation-view-interaction-manager';

export class SimulationView extends View {

	private _simViewInteractionManager: SimulationViewInteractionManager;

	constructor(project: Project, htmlContainer: HTMLElement, ticker: RenderTicker) {
		super(project, htmlContainer, ticker);
		this._simViewInteractionManager = new SimulationViewInteractionManager(this);
		this.applyOpenActions();
	}

	public placeComponentOnView(element: Element): ElementSprite {
		const es = super.placeComponentOnView(element);
		this._simViewInteractionManager.addEventListenersToNewElement(es);
		return es;
	}
}
