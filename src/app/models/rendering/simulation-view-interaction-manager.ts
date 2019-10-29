import {ElementSprite} from '../element-sprite';
import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {SimulationView} from './simulation-view';
import {ElementProviderService} from '../../services/element-provider/element-provider.service';
import {getStaticDI} from '../get-di';
import {NgZone} from '@angular/core';

export class SimulationViewInteractionManager {

	private _view: SimulationView;

	constructor(view: SimulationView) {
		this._view = view;
	}

	public addEventListenersToNewElement(elemSprite: ElementSprite) {
		getStaticDI(NgZone).runOutsideAngular(() => {
			elemSprite.sprite.interactive = true;
			elemSprite.sprite.on('pointerdown', (e: InteractionEvent) => {
				if (getStaticDI(WorkModeService).currentWorkMode !== 'simulation') return;
				this.onCompClick(e, elemSprite);
			});
		});
	}

	private onCompClick(e: InteractionEvent, elemSprite: ElementSprite) {
		if (getStaticDI(ElementProviderService).isUserElement(elemSprite.element.typeId) && e.data.button === 0) {
			getStaticDI(NgZone).run(() => {
				this._view.requestInspectElemEventEmitter.emit({
					identifier: `${this._view.parentProjectIdentifier}:${elemSprite.element.id}`,
					typeId: elemSprite.element.typeId,
					parentNames: [...this._view.parentProjectNames, this._view.projectName],
					parentTypeIds: [...this._view.parentTypeIds, this._view.projectId]
				});
			});
		} else if (getStaticDI(ElementProviderService).isButtonElement(elemSprite.element.typeId)) {

		} else if (getStaticDI(ElementProviderService).isLeverElement(elemSprite.element.typeId)) {

		}
	}

}
