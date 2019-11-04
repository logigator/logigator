import InteractionEvent = PIXI.interaction.InteractionEvent;
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {SimulationView} from './simulation-view';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {getStaticDI} from '../get-di';
import {NgZone} from '@angular/core';
import {WorkerCommunicationService} from '../../services/simulation/worker-communication/worker-communication.service';
import {LGraphics} from './l-graphics';

export class SimulationViewInteractionManager {

	private _view: SimulationView;

	private elementProviderService = getStaticDI(ElementProviderService);
	private workerCommunicationService = getStaticDI(WorkerCommunicationService);

	constructor(view: SimulationView) {
		this._view = view;
	}

	public addEventListenersToNewElement(sprite: LGraphics) {
		getStaticDI(NgZone).runOutsideAngular(() => {
			sprite.interactive = true;
			sprite.on('pointerdown', (e: InteractionEvent) => {
				if (getStaticDI(WorkModeService).currentWorkMode !== 'simulation') return;
				this.onCompClick(e, sprite);
			});
		});
	}

	private onCompClick(e: InteractionEvent, sprite: LGraphics) {
		if (this.elementProviderService.isUserElement(sprite.element.typeId) && e.data.button === 0) {
			getStaticDI(NgZone).run(() => {
				this._view.requestInspectElemEventEmitter.emit({
					identifier: `${this._view.parentProjectIdentifier}:${sprite.element.id}`,
					typeId: sprite.element.typeId,
					parentNames: [...this._view.parentProjectNames, this._view.projectName],
					parentTypeIds: [...this._view.parentTypeIds, this._view.projectId]
				});
			});
		} else if (this.elementProviderService.isButtonElement(sprite.element.typeId)) {
		} else if (this.elementProviderService.isLeverElement(sprite.element.typeId)) {
		}
	}

}
