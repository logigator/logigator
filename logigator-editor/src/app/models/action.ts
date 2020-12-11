import {Element} from './element';
import {Elements} from './elements';
import * as PIXI from 'pixi.js';

export type ActionType =
	'addComp' |
	'addWire' |
	'remComp' |
	'remWire' |
	'movMult' |
	'conWire' |
	'dcoWire' |
	'rotComp' |
	'numInpt' |
	'plugInd' |
	'compOpt' |
	'ediData';

export interface ChangeType {
	newElems: Element[];
	oldElems: Element[];
}

export interface Action {
	name: ActionType;
	element?: Element;
	others?: Element[];
	pos?: PIXI.Point;
	endPos?: PIXI.Point;
	options?: number[][];
	numbers?: number[]; // for rotation/numInput/plugIndex 0: new, 1: old
	data?: unknown[];
}

export class Actions {

	private static readonly REVERSE_ACTION: Map<ActionType, ActionType[]> = new Map<ActionType, ActionType[]>([
		['addComp', ['remComp']],
		['addWire', ['remWire']],
		['remComp', ['addComp']],
		['remWire', ['addWire']],
		['movMult', ['movMult']],
		['conWire', ['dcoWire']],
		['dcoWire', ['conWire']],
		['rotComp', ['rotComp']],
		['numInpt', ['numInpt']],
		['plugInd', ['plugInd']],
		['compOpt', ['compOpt']],
		['ediData', ['ediData']]
	]);

	public static reverseActions(actions: Action[]): Action[] {
		if (!actions)
			return actions;
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
			} else if (revAction.name === 'rotComp' || revAction.name === 'numInpt' || revAction.name === 'plugInd') {
				revAction.numbers = [...action.numbers].reverse();
			} else if (revAction.name === 'compOpt') {
				revAction.options = [...action.options].reverse();
			} else if (revAction.name === 'ediData') {
				revAction.data = [...action.data].reverse();
			}
		}
		return revActions;
	}

	public static connectWiresToActions(oldWires: Element[], newWires: Element[]): Action[] {
		const outActions: Action[] = new Array(oldWires.length + newWires.length);
		let i = 0;
		for (const oldWire of oldWires) {
			outActions[i++] = {
				name: 'remWire',
				element: oldWire
			};
		}
		for (const newWire of newWires) {
			outActions[i++] = {
				name: 'addWire',
				element: newWire
			};
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

	public static applyChangeToArray(change: ChangeType, elements: Element[]): Element[] {
		elements = elements.filter(e => !change.oldElems.find(o => o.id === e.id));
		return elements;
	}

	public static pushChange(changes: ChangeType, newChange: ChangeType): ChangeType {
		newChange.newElems.forEach(e => changes.newElems.push(e));
		newChange.oldElems.forEach(e => changes.oldElems.push(e));
		return changes;
	}

	public static applyChangeOnArrayAndActions(
		changes: ChangeType[], out: Action[], outElements: Set<Element>
	): Set<Element> {
		changes.forEach(change => {
			change.oldElems.forEach(e => {
				out.push({name: Elements.remActionName(e), element: e});
				outElements.delete(e);
			});
			change.newElems.forEach(e => {
				out.push({name: Elements.addActionName(e), element: e});
				outElements.add(e);
			});
		});
		return outElements;
	}

	public static applyChangeOnArrayAndActionsOnly(changes: ChangeType[], out: Action[]): void {
		for (const change of changes) {
			if (!change)
				continue;
			change.oldElems.forEach(e => {
				out.push({name: Elements.remActionName(e), element: e});
			});
			change.newElems.forEach(e => {
				out.push({name: Elements.addActionName(e), element: e});
			});
		}
	}

	public static printActions(actions: Action[]): void {
		if (!actions)
			return;
		actions.forEach(a => {
			if (a.element)
				console.log(a.name, a.element.id, a.element.pos, a.element.endPos, a.numbers);
			else
				console.log(a.name, a.pos, a.endPos);

		});
	}
}
