import {ProjectState} from './project-state';
import {Action, Actions} from './action';
import {Element} from './element';
import {Elements} from './elements';
import {Observable, Subject} from 'rxjs';
import * as PIXI from 'pixi.js';
import {CollisionFunctions} from './collision-functions';
// #!debug
import {BoardRecorder} from '../../../tests/auto-tests/board-recorder';
import {ElementProviderService} from '../services/element-provider/element-provider.service';
import {ProjectType} from './project-type';
import {getStaticDI} from './get-di';
import {ElementTypeId} from './element-types/element-type-ids';

export interface ProjectConfiguration {
	id?: number;
	name?: string;
	type?: ProjectType;
	hash?: string;
	public?: boolean;
	link?: string;
	source: 'server' | 'local' | 'share';
}

export class Project {

	private readonly _id: number;
	private _name: string;
	private _isPublic: boolean;
	private _link: string;
	private readonly _type: ProjectType;
	private _hash: string;
	private readonly _source: 'server' | 'local' | 'share';

	private readonly _currState: ProjectState;

	private readonly _actions: Action[][];
	private _maxActionCount = 1000;
	private _currActionPointer: number;
	private _currMaxActionPointer: number;

	private readonly _changeSubject: Subject<Action[]>;

	public saveDirty = false;
	public compileDirty = true;

	private _stateActionFlag = false;

	private _actionToApply: Action[] = [];

	// #!debug
	public boardRecorder: BoardRecorder;

	public constructor(projectState: ProjectState, config: ProjectConfiguration) {
		this._currState = projectState;
		this._actions = new Array(this._maxActionCount);
		this._id = config.id;
		this._name = config.name;
		this._type = config.type ?? 'comp';
		this._hash = config.hash;
		this._source = config.source;
		this._isPublic = config.public ?? false;
		this._link = config.link;
		this._currActionPointer = -1;
		this._currMaxActionPointer = -1;
		this._changeSubject = new Subject<Action[]>();

		// #!debug
		this.boardRecorder = new BoardRecorder(this, true);
	}

	public static empty(name?: string, id?: number): Project {
		return new Project(new ProjectState(), {
			type: 'project',
			source: 'local',
			name: name ?? 'New Project',
			id: id ?? 0
		});
	}


	private applyActions(actions: Action[]): void {
		this.saveDirty = true;
		this.compileDirty = true;
		actions.forEach(action => this.applyAction(action));
	}

	private applyAction(action: Action): void {
		switch (action.name) {
			case 'addComp':
			case 'addWire':
				this._currState.addElement(action.element, action.element.id);
				break;
			case 'remComp':
			case 'remWire':
				this._currState.removeElement(action.element.id);
				break;
			case 'movMult':
				for (const elem of action.others) {
					this._currState.moveElement(elem, action.pos);
				}
				break;
			case 'conWire':
				this._currState.addConPointIfNotExists(action.pos);
				break;
			case 'dcoWire':
				this._currState.remConPointIfExists(action.pos);
				break;
			case 'rotComp':
				this._currState.rotateComp(action.element, action.numbers[0]);
				break;
			case 'numInpt':
				this._currState.setNumInputs(action.element, action.numbers[0]);
				break;
			case 'plugInd':
				this._currState.setPlugId(action.element, action.numbers[0]);
				break;
			case 'compOpt':
				this._currState.setOptions(action.element, action.options[0]);
				break;
			case 'ediData':
				this._currState.setData(action.element, action.data[0]);
				break;
		}
	}

	public getOpenActions(): Action[] {
		const out: Action[] = [];
		for (const element of this.allElements) {
			out.push({
				name: Elements.addActionName(element),
				pos: element.pos,
				endPos: element.endPos,
				element
			});
		}
		for (const chunks of this._currState.chunks) {
			for (const chunk of chunks) {
				if (!chunk || !chunk.connectionPoints)
					continue;
				for (const cp of chunk.connectionPoints) {
					out.push({
						name: 'conWire',
						pos: cp.clone()
					});
				}
			}
		}
		return out;
	}

	public chunksToRender(start: PIXI.Point, end: PIXI.Point): { x: number, y: number }[] {
		const out = CollisionFunctions.inRectChunks(start, end);
		for (const chunk of this._currState.chunksFromCoords(out)) {
			chunk.links.forEach((linkedChunk, _) => {
				if (!out.find(c => c.x === linkedChunk.x && c.y === linkedChunk.y))
					out.push({x: linkedChunk.x, y: linkedChunk.y});
			});
		}
		return out;
	}

	public addElements(elements: Element[], dif?: PIXI.Point): boolean {
		if (!dif)
			dif = new PIXI.Point(0, 0);
		if (!this._currState.allSpacesFree(elements, dif))
			return false;

		// #!debug
		this.boardRecorder.call('addElements', arguments, -1, -1, 0);
		const actions: Action[] = new Array(elements.length);
		let i = 0;
		elements.forEach(elem => {
			Elements.move(elem, dif);
			this._currState.addElement(elem);
			actions[i] = {
				name: Elements.addActionName(elem),
				element: elem
			};
			i++;
		});
		let wireEndsToUpdate = Elements.allWireEnds(elements);
		wireEndsToUpdate = this._currState.pointsThatSplit(elements, wireEndsToUpdate);
		actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate));
		this.newState(actions);
		return true;
	}

	public addElement(typeId: number, _pos: PIXI.Point, _endPos?: PIXI.Point): Element {
		if (typeId === ElementTypeId.WIRE && !_endPos)
			return null;
		if (typeId === ElementTypeId.WIRE && _pos.equals(_endPos))
			return null;
		const element = Elements.genNewElement(typeId, _pos, _endPos);
		element.endPos = element.endPos || Elements.calcEndPos(element);
		if (!this._currState.isFreeSpace(element.pos, element.endPos, typeId === ElementTypeId.WIRE, Elements.wireEnds(element)))
			return null;

		// #!debug
		this.boardRecorder.call('addElement', arguments);
		this._currState.addElement(element);
		const actions: Action[] = [{
			name: Elements.addActionName(element),
			element
		}];
		let wireEndsToUpdate = Elements.allWireEnds([element]);
		wireEndsToUpdate = this._currState.pointsThatSplit([element], wireEndsToUpdate);
		actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate));
		this.newState(actions);
		return element;
	}

	public addWire(_pos: PIXI.Point, _cornerPos: PIXI.Point, _endPos?: PIXI.Point): Element[] {
		if (_cornerPos.equals(_pos)) {
			_cornerPos = _endPos;
			_endPos = undefined;
		}
		if (!_endPos || _cornerPos.equals(_endPos)) {
			const elem = this.addElement(ElementTypeId.WIRE, _pos, _cornerPos);
			return elem ? [elem] : null;
		}
		const {wire0, wire1} = Elements.gen2Wires(_pos, _cornerPos, _endPos);
		if (!this._currState.allSpacesFree([wire0, wire1], new PIXI.Point(0, 0)))
			return null;

		// #!debug
		this.boardRecorder.call('addWire', arguments);
		this._currState.addElement(wire0);
		this._currState.addElement(wire1);
		const actions = this.actionsFromAddWires([wire0, wire1]);
		this.newState(actions);
		return [wire0, wire1];
	}

	private actionsFromAddWires(wires: Element[]): Action[] {
		const actions: Action[] = [];
		wires.forEach(wire => actions.push({name: 'addWire', element: wire}));
		let wireEndsToUpdate = Elements.allWireEnds(wires);
		wireEndsToUpdate = this._currState.pointsThatSplit(wires, wireEndsToUpdate);
		actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate));
		return actions;
	}


	public removeElementsById(ids: number[]): void {
		// #!debug
		this.boardRecorder.call('removeElementsById', arguments, -1, 0);
		const actions: Action[] = [];
		const elements: Element[] = new Array(ids.length);
		let i = 0;
		ids.forEach(id => {
			const elem = this._currState.removeElement(id);
			elements[i++] = elem;
			const action: Action = {
				name: Elements.remActionName(elem),
				element: elem
			};
			actions.push(action);
			actions.push(...this._currState.plugIndexActions);
			this._currState.plugIndexActions = [];
		});
		let wireEndsToUpdate = Elements.allWireEnds(elements);
		wireEndsToUpdate = this._currState.pointsThatSplit(elements, wireEndsToUpdate);
		actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate));
		this.newState(actions);
	}


	public eraseElements(from: PIXI.Point, to: PIXI.Point): void {
		// #!debug
		this.boardRecorder.call('eraseElements', arguments);
		const elements = this._currState.elementsOverLine(from, to);
		if (elements.length === 0)
			return;
		const actions: Action[] = [];
		for (const element of elements) {
			actions.push({
				name: Elements.remActionName(element),
				element
			});
			this._currState.removeElement(element.id);
			actions.push(...this._currState.plugIndexActions);
			this._currState.plugIndexActions = [];
		}
		let wireEndsToUpdate = Elements.allWireEnds(elements);
		wireEndsToUpdate = this._currState.pointsThatSplit(elements, wireEndsToUpdate);
		actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate), ...this._currState.specialActions);
		this._currState.specialActions = [];
		this._actionToApply.push(...actions);
		this._changeSubject.next(actions);
	}

	public stopErase(): void {
		// #!debug
		this.boardRecorder.call('stopErase', arguments);
		if (this._actionToApply.length === 0)
			return;
		this.newState(this._actionToApply, false, true);
		this._actionToApply = [];
	}


	public moveElementsById(ids: number[], dif: PIXI.Point): boolean {
		const elements = this._currState.getElementsById(ids);
		if (dif.x === 0 && dif.y === 0) {
			this._changeSubject.next([{
				name: 'movMult',
				others: elements,
				pos: dif
			}]);
			this.cancelLastStep();
			return true;
		}
		if (!this._currState.allSpacesFree(elements, dif, new Set<Element>(elements)))
			return false;
		let wireEndsToUpdate = Elements.allWireEnds(elements);

		// #!debug
		this.boardRecorder.call('moveElementsById', arguments, -1, 0);
		for (const elem of elements) {
			this._currState.moveElement(elem, dif);
		}
		const actions: Action[] = [{
			name: 'movMult',
			others: elements,
			pos: dif
		}];
		wireEndsToUpdate = Elements.allWireEnds(elements, wireEndsToUpdate);
		wireEndsToUpdate = this._currState.pointsThatSplit(elements, wireEndsToUpdate);
		actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate));
		this.newState(actions);
		return true;
	}


	public rotateComponent(id: number, rotation: number): boolean {
		const element = this._currState.getElementById(id);
		if (element.typeId === ElementTypeId.WIRE || element.typeId === ElementTypeId.TEXT)
			return;
		const actions: Action[] = [{
			name: 'rotComp',
			element,
			numbers: [rotation, element.rotation]
		}];
		let wireEndsToUpdate = Elements.allWireEnds([element]);
		const newEndPos = Elements.calcEndPos(element, undefined, undefined, rotation);
		if (!this._currState.isFreeSpace(element.pos, newEndPos, false,
			Elements.wireEndsWithChanges(element, rotation, element.numInputs, new PIXI.Point()), new Set<Element>([element])))
			return false;

		// #!debug
		this.boardRecorder.call('rotateComponent', arguments, 0);
		this._currState.rotateComp(element, rotation, newEndPos);
		wireEndsToUpdate = Elements.allWireEnds([element], wireEndsToUpdate);
		wireEndsToUpdate = this._currState.pointsThatSplit([element], wireEndsToUpdate);
		actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate));
		this.newState(actions);
		return true;
	}


	public setNumInputs(id: number, numInputs: number): boolean {
		const element = this._currState.getElementById(id);
		if (element.typeId === ElementTypeId.WIRE || element.typeId === ElementTypeId.TEXT)
			return;
		const actions: Action[] = [{
			name: 'numInpt',
			element,
			numbers: [numInputs, element.numInputs]
		}];
		let wireEndsToUpdate = Elements.allWireEnds([element]);
		const newEndPos = Elements.calcEndPos(element, numInputs);
		if (!this._currState.isFreeSpace(element.pos, newEndPos, false,
			Elements.wireEndsWithChanges(element, element.rotation, numInputs, new PIXI.Point()), new Set<Element>([element])))
			return false;

		// #!debug
		this.boardRecorder.call('setNumInputs', arguments, 0);
		this._currState.setNumInputs(element, numInputs, newEndPos);
		wireEndsToUpdate = Elements.allWireEnds([element], wireEndsToUpdate);
		wireEndsToUpdate = this._currState.pointsThatSplit([element], wireEndsToUpdate);
		actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate));
		this.newState(actions);
		return true;
	}


	public setPlugIndex(elemId: number, index: number): boolean {
		const element = this._currState.getElementById(elemId);
		if (!this._currState.possiblePlugIds(element).includes(index))
			return false;
		const oldIndex = element.plugIndex;
		this._currState.setPlugId(element, index);
		const action: Action = {
			name: 'plugInd',
			element,
			numbers: [element.plugIndex, oldIndex]
		};
		this.newState([action]);
		return true;
	}

	public setPlugConfiguration(plugsIds: number[], labels: string[]): boolean {
		const numPlugs = this.numInputs + this.numOutputs;
		if (numPlugs !== plugsIds.length || numPlugs !== labels.length)
			return false;
		for (let i = 0; i < this.numInputs; i++) {
			if (this._currState.getElementById(plugsIds[i]).typeId !== ElementTypeId.INPUT)
				return false;
		}
		for (let i = this.numInputs; i < this.numOutputs; i++) {
			if (this._currState.getElementById(plugsIds[i]).typeId !== ElementTypeId.OUTPUT)
				return false;
		}
		const actions: Action[] = [];
		for (let i = 0; i < plugsIds.length; i++) {
			const element = this._currState.getElementById(plugsIds[i]);
			const oldIndex = element.plugIndex;
			this._currState.setPlugIdWithoutChangingOthers(element, i);
			actions.push({
				name: 'plugInd',
				element,
				numbers: [element.plugIndex, oldIndex]
			});
			const oldData = element.data;
			this._currState.setData(element, labels[i]);
			actions.push({
				name: 'ediData',
				element,
				data: [element.data, oldData]
			});
		}
		this.newState(actions);
		return true;
	}

	public possiblePlugIndexes(elemId: number): number[] {
		return this._currState.possiblePlugIds(this._currState.getElementById(elemId));
	}

	public setOptions(elemId: number, options: number[]): boolean {
		const element = this._currState.getElementById(elemId);
		const canSizeChange = !!getStaticDI(ElementProviderService).getElementById(element.typeId).onOptionsChanged;
		const oldOptions = [...element.options];
		let wireEndsToUpdate = canSizeChange ? Elements.allWireEnds([element]) : undefined;

		const clone = Elements.cloneSetOptions(element, options);
		if (canSizeChange && !this._currState.isFreeSpace(clone.pos, clone.endPos, false,
			Elements.wireEnds(clone), new Set<Element>([element])))
			return false;
		this._currState.setOptions(element, options);
		const actions: Action[] = [{
			element,
			name: 'compOpt',
			options: [options, oldOptions]
		}];
		if (canSizeChange) {
			wireEndsToUpdate = Elements.allWireEnds([element], wireEndsToUpdate);
			wireEndsToUpdate = this._currState.pointsThatSplit([element], wireEndsToUpdate);
			actions.push(...this.autoAssembleWireEnds(wireEndsToUpdate));
		}
		this.newState(actions);
		return true;
	}


	public addText(text: string, _pos: PIXI.Point): Element {
		const elem = Elements.genNewElement(ElementTypeId.TEXT, _pos, _pos);
		elem.data = text;

		this._currState.addElement(elem);
		const actions: Action[] = [{
			name: Elements.addActionName(elem),
			element: elem
		}];
		this.newState(actions);
		return elem;
	}


	public setData(elemId: number, data: any): void {
		const element = this._currState.getElementById(elemId);
		const oldData = element.data;
		this._currState.setData(element, data);
		const action: Action = {
			name: 'ediData',
			element,
			data: [element.data, oldData]
		};
		this.newState([action]);
	}


	public updateInputsOutputs(typeId?: number): void {
		const actions: Action[] = [];
		for (const elem of this.allElements) {
			if (elem.typeId === typeId || !typeId && getStaticDI(ElementProviderService).isCustomElement(elem.typeId)) {
				this._currState.updateNumInputsOutputs(elem);
				actions.push({
					name: 'rotComp',
					element: elem
				});
			}
		}
		this._changeSubject.next(actions);
	}


	public updateLabels(typeId?: number): void {
		const actions: Action[] = [];
		for (const elem of this.allElements) {
			if (elem.typeId === typeId || !typeId && getStaticDI(ElementProviderService).isCustomElement(elem.typeId)) {
				actions.push({
					name: 'rotComp',
					element: elem
				});
			}
		}
		this._changeSubject.next(actions);
	}


	public calcLabels(): string[] {
		const plugs = this._currState.allPlugs();
		const out: string[] = [];
		for (const plug of plugs) {
			out.push(plug.data as string || '');
		}
		return out;
	}


	public toggleWireConnection(pos: PIXI.Point): void {
		// #!debug
		this.boardRecorder.call('toggleWireConnection', arguments);
		const wiresOnPoint = this._currState.wiresOnPoint(pos);
		let actions: Action[];
		if (wiresOnPoint.length === 2) {
			actions = this.connectWires(pos, wiresOnPoint);
		} else if (wiresOnPoint.length === 4) {
			actions = this.disconnectWires(wiresOnPoint);
		} else if (wiresOnPoint.length === 3) {
			const elemsOnPoint = this._currState.elemsOnPoint(pos);
			if (elemsOnPoint.length === 4) {
				actions = this.disconnectWires(wiresOnPoint);
			}
		} else {
			return;
		}
		this.newState(actions);
	}

	private connectWires(pos: PIXI.Point, wiresToConnect: Element[]): Action[] {
		const newWires = this._currState.connectWires(wiresToConnect[0], wiresToConnect[1], pos);
		this._currState.loadConnectionPoints(newWires);
		return Actions.connectWiresToActions(wiresToConnect, newWires);
	}

	private disconnectWires(wiresOnPoint: Element[]): Action[] {
		const newWires = this._currState.disconnectWires(wiresOnPoint);
		this._currState.loadConnectionPoints(wiresOnPoint);
		return Actions.connectWiresToActions(wiresOnPoint, newWires);
	}


	public splitWire(element: Element, pos: PIXI.Point): {
		actions: Action[],
		elements: Element[]
	} {
		const newWires = this._currState.splitWire(element, pos);
		if (newWires.length === 0)
			return {
				actions: [],
				elements: [element]
			};
		this._currState.loadConnectionPoints(newWires);
		return {
			actions: Actions.connectWiresToActions([element], newWires),
			elements: newWires
		};
	}

	private autoAssembleWireEnds(wireEnds: Map<number, Set<number>>): Action[] {
		return this._currState.actionToBoard(wireEnds);
	}


	public newState(actions: Action[], setStateActionFlag?: boolean, skipSubject?: boolean): void {
		if (!actions)
			return;
		actions.push(...this._currState.specialActions);
		this._currState.specialActions = [];
		if (this._stateActionFlag) {
			this._actions[this._currActionPointer].push(...actions);
			this._stateActionFlag = false;
		} else {
			if (this._currActionPointer >= this._maxActionCount) {
				this._actions.shift();
			} else {
				this._currActionPointer++;
			}
			this._currMaxActionPointer = this._currActionPointer;
			this._actions[this._currActionPointer] = actions;
		}
		this.saveDirty = true;
		this.compileDirty = true;
		if (!setStateActionFlag && !skipSubject) {
			this._changeSubject.next(actions);
		} else if (setStateActionFlag) {
			this._stateActionFlag = true;
		}
	}

	public stepBack(): Action[] {
		if (this._currActionPointer < 0)
			return;

		// #!debug
		this.boardRecorder.call('stepBack', arguments);
		const backActions = Actions.reverseActions(this._actions[this._currActionPointer]);
		this._currActionPointer--;
		this.applyActions(backActions);
		this._changeSubject.next(backActions);
		this._currState.specialActions = [];
		return backActions;
	}

	public stepForward(): Action[] {
		if (this._currActionPointer >= this._maxActionCount || this._currActionPointer === this._currMaxActionPointer)
			return;

		// #!debug
		this.boardRecorder.call('stepForward', arguments);
		const outActions = this._actions[++this._currActionPointer];
		this.applyActions(outActions);
		this._changeSubject.next(outActions);
		this._currState.specialActions = [];
		return outActions;
	}

	public cancelLastStep(): void {
		if (this._currActionPointer < 0 || !this._stateActionFlag)
			return;

		this.stepBack();
		this._currMaxActionPointer--;
		this._stateActionFlag = false;
	}


	get allElements(): Element[] {
		return this._currState.allElements;
	}

	get changes(): Observable<Action[]> {
		return this._changeSubject.asObservable();
	}

	get currState(): ProjectState {
		return this._currState;
	}

	get id(): number {
		return this._id;
	}

	get name(): string {
		return this._name;
	}

	set name(value: string) {
		this._name = value;
	}

	get type(): ProjectType {
		return this._type;
	}

	get numInputs() {
		return this._currState.numInputs;
	}

	get numOutputs() {
		return this._currState.numOutputs;
	}

	get hash(): string {
		return this._hash;
	}

	set hash(value: string) {
		this._hash = value;
	}

	get source(): 'server' | 'local' | 'share' {
		return this._source;
	}

	get isPublic(): boolean {
		return this._isPublic;
	}

	set isPublic(value: boolean) {
		this._isPublic = value;
	}

	get link(): string {
		return this._link;
	}

	set link(value: string) {
		this._link = value;
	}
}
