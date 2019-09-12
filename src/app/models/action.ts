import {Element} from './element';
import * as PIXI from 'pixi.js';

export type ActionType = 'addComp' |
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
				name: 'remComp',
				element: oldWire
			});
		}
		for (const newWire of newWires) {
			outActions.push({
				name: 'addComp',
				element: newWire
			});
		}
		return outActions;
	}
}
