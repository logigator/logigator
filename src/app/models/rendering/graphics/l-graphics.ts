import * as PIXI from 'pixi.js';
import {Element} from '../../element';

export interface ComponentUpdatable {

	/**
	 * updates the {Element} LGraphics uses for rendering
	 * @param scale scale Scale to use for rendering
	 * @param newElement new {Element} used for rendering
	 */
	updateComponent(scale: number, newElement: Element);
}

export interface ComponentScalable {
	updateScale(scale: number);
}

export interface ComponentSelectable {

	/**
	 * sets the selection state of the component
	 * @param selected is the element selected
	 */
	setSelected(selected: boolean);
}

export interface ComponentResetable {

	/**
	 * Component state is reset, used for IO Components, when the user clicks the stop simulation button
	 */
	resetSimState();
}

export interface LGraphics extends PIXI.DisplayObject, ComponentScalable, ComponentSelectable {

	/**
	 * Element that is rendered by LGraphics
	 */
	readonly element: Element;

	/**
	 * Applies the current simulation state, means the new state is rendered no matter if the component is visible on screen
	 * @param scale Scale to use for rendering
	 */
	applySimState(scale: number);

	/**
	 * Sets the state of the component, but is only applied if the component is currently visible on screen
	 * @param state Array of states of all inputs and outputs
	 */
	setSimulationState(state: boolean[]);
}

export function isLGraphics(object: any): object is LGraphics {
	return 'applySimState' in object &&
		'updateScale' in object &&
		'setSelected' in object &&
		'setSimulationState' in object &&
		'element' in object;
}

export function isUpdatable(object: any): object is ComponentUpdatable {
	return 'updateComponent' in object;
}

export function isScalable(object: any): object is ComponentSelectable {
	return 'updateScale' in object;
}

export function isResetable(object: any): object is ComponentResetable {
	return 'resetSimState' in object;
}
