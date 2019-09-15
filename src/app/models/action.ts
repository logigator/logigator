import {Element} from './element';
import * as PIXI from 'pixi.js';

export type ActionType =
	'addComp' |
	'addWire' |
	'addText' |
	'remComp' |
	'remWire' |
	'remText' |
	'movMult' |
	'conWire' |
	'dcoWire' |
	'setComp';

export interface Action {
	name: ActionType;	// TODO element settings
	element?: Element;
	others?: Element[];
	oldElements?: Element[];
	id?: number;
	pos?: PIXI.Point;
	endPos?: PIXI.Point;
}

export class Actions {

	private static readonly REVERSE_ACTION: Map<ActionType, ActionType[]> = new Map<ActionType, ActionType[]>([
		['addComp', ['remComp']],
		['addWire', ['remWire']],
		['addText', ['remText']],
		['remComp', ['addComp']],
		['remWire', ['addWire']],
		['remText', ['addText']],
		['movMult', ['movMult']],
		['conWire', ['dcoWire']],
		['dcoWire', ['conWire']],
		['setComp', ['setComp']]
	]);

	public static reverseActions(actions: Action[]): Action[] {
		const out: Action[] = [];
		for (let i = actions.length - 1; i > -1; i--) {
			out.push(...Actions.reverseAction(actions[i]));
		}
		return out;
	}

	public static reverseAction(action: Action): Action[] {
		const revActions = [{...action}];
		revActions[0].name = Actions.REVERSE_ACTION.get(action.name)[0];
		for (const revAction of revActions) {
			revAction.pos = action.pos ? action.pos.clone() : undefined;
			revAction.endPos = action.endPos ? action.endPos.clone() : undefined;
			if (revAction.name === 'movMult') {
				revAction.pos.x *= -1;
				revAction.pos.y *= -1;
			}
		}
		return revActions;
	}

	public static connectWiresToActions(oldWires, newWires): Action[] {
		const outActions: Action[] = [];
		for (const oldWire of oldWires) {
			outActions.push({
				name: 'remWire',
				element: oldWire
			});
		}
		for (const newWire of newWires) {
			outActions.push({
				name: 'addWire',
				element: newWire
			});
		}
		return outActions;
	}

	public static applyActionsToArray(actions: Action[], elements: Element[]): Element[] {
		for (const action of actions) {
			if (action.name[0] === 'a')
				elements.push(action.element);
			if (action.name[0] === 'r')
				elements = elements.filter(e => e.id !== action.element.id);
		}
		return elements;
	}

	public static applyChangeToArray(change: {newElem: Element, oldElems: Element[]}, elements: Element[]): Element[] {
		for (const oldElem of change.oldElems) {
			elements = elements.filter(e => e.id !== oldElem.id);
		}
		elements.push(change.newElem);
		return elements;
	}

	public static applyChangeOnArrayAndActions(
		elemChanges: { newElem: Element; oldElems: Element[] }[], out: Action[], outElements: Element[]
	): Element[] {
		for (const change of elemChanges) {
			for (const oldElem of change.oldElems) {
				out.push({name: 'remWire', element: oldElem});
				outElements = outElements.filter(e => e.id !== oldElem.id);
			}
			out.push({name: 'addWire', element: change.newElem});
			outElements.push(change.newElem);
		}
		return outElements;
	}
}
