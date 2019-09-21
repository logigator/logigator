import {View} from './view';
import {ElementSprite} from '../element-sprite';
import * as PIXI from 'pixi.js';
import InteractionEvent = PIXI.interaction.InteractionEvent;
import {WorkModeService} from '../../services/work-mode/work-mode.service';

export class SimulationViewInteractionManager {

	private _view: View;

	constructor(view: View) {
		this._view = view;
	}

	public addEventListenersToNewElement(elemSprite: ElementSprite) {
		elemSprite.sprite.interactive = true;
		elemSprite.sprite.on('pointerdown', (e: InteractionEvent) => {
			if (WorkModeService.staticInstance.currentWorkMode !== 'simulation') return;
			this.onCompClick(e, elemSprite);
		});
	}

	private onCompClick(e: InteractionEvent, elemSprite: ElementSprite) {
		console.log(elemSprite);
	}

}
