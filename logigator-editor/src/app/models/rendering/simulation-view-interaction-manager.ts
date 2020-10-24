import * as PIXI from 'pixi.js';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {SimulationView} from './simulation-view';
import {getStaticDI} from '../get-di';
import {NgZone} from '@angular/core';
import {LGraphics} from './graphics/l-graphics';
import {WorkMode} from '../work-modes';

export class SimulationViewInteractionManager {

	private _view: SimulationView;

	constructor(view: SimulationView) {
		this._view = view;
	}

	public addEventListenersToCustomElement(sprite: LGraphics) {
		getStaticDI(NgZone).runOutsideAngular(() => {
			sprite.interactive = true;
			sprite.on('pointerdown', (e: PIXI.InteractionEvent) => {
				if (getStaticDI(WorkModeService).currentWorkMode !== WorkMode.SIMULATION) return;
				this.onCompClick(e, sprite);
			});
		});
	}

	private onCompClick(e: PIXI.InteractionEvent, sprite: LGraphics) {
		if (e.data.button === 0) {
			getStaticDI(NgZone).run(() => {
				this._view.requestInspectElemEventEmitter.emit({
					identifier: `${this._view.parentProjectIdentifier}:${sprite.element.id}`,
					typeId: sprite.element.typeId,
					parentNames: [...this._view.parentProjectNames, this._view.project.name],
					parentTypeIds: [...this._view.parentTypeIds, this._view.project.id]
				});
			});
		}
	}

}
