import * as PIXI from 'pixi.js';
import {SimulationView} from './simulation-view';
import {getStaticDI} from '../get-di';
import {NgZone} from '@angular/core';
import {ComponentInspectable, LGraphics} from './graphics/l-graphics';

export class SimulationViewInteractionManager {

	private _view: SimulationView;

	private _ngZone = getStaticDI(NgZone);

	constructor(view: SimulationView) {
		this._view = view;
	}

	public addEventListenersToCustomElement(sprite: LGraphics) {
		this._ngZone.runOutsideAngular(() => {
			sprite.interactive = true;
			sprite.on('pointerdown', (e: PIXI.InteractionEvent) => {
				this.onCompClick(e, sprite);
			});
		});
	}

	private onCompClick(e: PIXI.InteractionEvent, sprite: LGraphics) {
		if (e.data.button === 0) {
			this._ngZone.run(() => {
				this._view.requestInspectElemEventEmitter.emit({
					identifier: `${this._view.parentProjectIdentifier}:${sprite.element.id}`,
					sprite: sprite as ComponentInspectable,
					typeId: sprite.element.typeId,
					parentNames: [...this._view.parentProjectNames, this._view.project.name],
					parentTypeIds: [...this._view.parentTypeIds, this._view.project.id]
				});
			});
		}
	}

}
