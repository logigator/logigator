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

export class Project {


	private readonly _id: number;
	private _name: string;
	private _type: ProjectType;
	private _version: number;

	private _currState: ProjectState;

	private readonly _actions: Action[][];
	private _maxActionCount = 1000;
	private _currActionPointer: number;
	private _currMaxActionPointer: number;

	private _changeSubject: Subject<Action[]>;

	public saveDirty = false;
	public compileDirty = true;

	private _stateActionFlag = false;

	private _actionToApply: Action[] = [];

	// #!debug
	public boardRecorder: BoardRecorder;

	public constructor(projectState: ProjectState, config: { id?: number, name?: string, type?: ProjectType, version?: number }) {
		this._currState = projectState;
		this._actions = new Array(this._maxActionCount);
		this._id = config.id;
		this._name = config.name;
		this._type = config.type || 'comp';
		this._version = config.version ?? 0;
		this._currActionPointer = -1;
		this._currMaxActionPointer = -1;
		this._changeSubject = new Subject<Action[]>();

		// #!debug
		this.boardRecorder = new BoardRecorder(this, true);
	}

	public static empty(name?: string): Project {
		return new Project(new ProjectState(), {
			type: 'project',
			name: name || 'New Project',
			id: 0
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
				this._currState.loadConIntoChunks(action.pos);
				break;
			case 'dcoWire':
				this._currState.removeConFromChunks(action.pos);
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
		for (const outerChunk of this._currState.chunksFromCoords(out)) {
			for (const elem of outerChunk.elements) {
				const chunk = CollisionFunctions.gridPosToChunk(elem.pos);
				if (!out.find(c => c.x === chunk.x && c.y === chunk.y))
					out.push({x: chunk.x, y: chunk.y});
			}
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
		const changed = this._currState.withWiresOnEdges(elements);
		actions.push(...this.autoAssemble(changed));
		this.newState(actions);
		return true;
	}

	public addElement(typeId: number, _pos: PIXI.Point, _endPos?: PIXI.Point): Element {
		if (typeId === ElementTypeId.WIRE && !_endPos)
			return null;
		if (typeId === ElementTypeId.WIRE && _pos.equals(_endPos))
			return null;
		const elem = Elements.genNewElement(typeId, _pos, _endPos);
		elem.endPos = elem.endPos || Elements.calcEndPos(elem);
		if (!this._currState.isFreeSpace(elem.pos, elem.endPos, typeId === ElementTypeId.WIRE, Elements.wireEnds(elem)))
			return null;

		// #!debug
		this.boardRecorder.call('addElement', arguments);
		this._currState.addElement(elem);
		const actions: Action[] = [{
			name: Elements.addActionName(elem),
			element: elem
		}];
		actions.push(...this.autoAssemble([elem]));
		this.newState(actions);
		return elem;
	}

	public addWire(_pos: PIXI.Point, _cornerPos: PIXI.Point, _endPos?: PIXI.Point): Element[] {
		if (_cornerPos.equals(_pos)) {
			_cornerPos = _endPos;
			_endPos = undefined;
		}
		if (!_endPos || _cornerPos.equals(_endPos)) {
			const elem = this.addElement(0, _pos, _cornerPos);
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
		actions.push(...this.autoAssemble(wires));
		return actions;
	}


	public removeElementsById(ids: number[]): void {
		// #!debug
		this.boardRecorder.call('removeElementsById', arguments, -1, 0);
		const actions: Action[] = [];
		const onEdges: Element[] = [];
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
		});
		elements.forEach(elem => {
			for (const pos of Elements.wireEnds(elem)) {
				onEdges.push(...this._currState.wiresOnPoint(pos));
			}
		});
		this._currState.loadConnectionPoints(elements);
		actions.push(...this.autoAssemble(onEdges));
		this.newState(actions);
	}


	public eraseElements(from: PIXI.Point, to: PIXI.Point): void {
		// #!debug
		this.boardRecorder.call('eraseElements', arguments);
		const elements = this._currState.elementsOverLine(from, to);
		if (elements.length === 0)
			return;
		const actions: Action[] = new Array(elements.length);
		const onEdges: Element[] = [];
		let i = 0;
		for (const element of elements) {
			actions[i++] = {
				name: Elements.remActionName(element),
				element
			};
			this._currState.removeElement(element.id);
		}
		elements.forEach(elem => {
			for (const pos of Elements.wireEnds(elem)) {
				onEdges.push(...this._currState.wiresOnPoint(pos));
			}
		});
		this._currState.loadConnectionPoints(elements);
		actions.push(...this.autoAssemble(onEdges), ...this._currState.specialActions);
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
		const changed = this._currState.withWiresOnEdges(elements);

		// #!debug
		this.boardRecorder.call('moveElementsById', arguments, -1, 0);
		this._currState.removeAllConnectionPoints(elements);
		for (const elem of elements) {
			this._currState.moveElement(elem, dif);
		}
		const actions: Action[] = [{
			name: 'movMult',
			others: elements,
			pos: dif
		}];
		actions.push(...this.autoAssemble(changed));
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
		const changed = this._currState.withWiresOnEdges([element]);
		const newEndPos = Elements.calcEndPos(element, undefined, undefined, rotation);
		if (!this._currState.isFreeSpace(element.pos, newEndPos, false,
			Elements.wireEnds(element, rotation), new Set<Element>([element])))
			return false;

		// #!debug
		this.boardRecorder.call('rotateComponent', arguments, 0);
		this._currState.rotateComp(element, rotation, newEndPos);
		actions.push(...this.autoAssemble(changed));
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
		const changed = this._currState.withWiresOnEdges([element]);
		const newEndPos = Elements.calcEndPos(element, numInputs);
		if (!this._currState.isFreeSpace(element.pos, newEndPos, false,
			Elements.wireEnds(element, undefined, numInputs), new Set<Element>([element])))
			return false;

		// #!debug
		this.boardRecorder.call('setNumInputs', arguments, 0);
		this._currState.setNumInputs(element, numInputs, newEndPos);
		actions.push(...this.autoAssemble(changed));
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

	public possiblePlugIndexes(elemId: number): number[] {
		return this._currState.possiblePlugIds(this._currState.getElementById(elemId));
	}

	public setOptions(elemId: number, options: number[]): void {
		const elem = this._currState.getElementById(elemId);
		const oldOptions = [...elem.options];
		this._currState.setOptions(elem, options);
		const action: Action = {
			element: elem,
			name: 'compOpt',
			options: [options, oldOptions]
		};
		this.newState([action]);
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
			if (elem.typeId === typeId || !typeId && getStaticDI(ElementProviderService).isUserElement(elem.typeId)) {
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
			if (elem.typeId === typeId || !typeId && getStaticDI(ElementProviderService).isUserElement(elem.typeId)) {
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
		this._currState.loadConnectionPoints(newWires.concat(wiresOnPoint));
		return Actions.connectWiresToActions(wiresOnPoint, newWires);
	}


	public splitWire(element: Element, pos: PIXI.Point): {
		actions: Action[],
		elements: Element[]
	} {
		const newWires = this._currState.splitWire(element, pos);
		if (newWires.length === 1)
			return {
				actions: [],
				elements: newWires
			};
		this._currState.loadConnectionPoints(newWires);
		return {
			actions: Actions.connectWiresToActions([element], newWires),
			elements: newWires
		};
	}


	private autoAssemble(elements: Element[]): Action[] {
		Elements.removeDuplicates(elements);
		const out: Action[] = [];
		const merged = this.autoMerge(elements);
		out.push(...merged.actions);
		const connected = this.autoConnect(merged.elements);
		out.push(...connected.actions);
		this._currState.loadConnectionPoints(connected.elements.concat(elements));
		return out;
	}

	private autoConnect(elements: Element[]): { actions: Action[], elements: Element[] } {
		const out: Action[] = [];
		let outElements = [...elements];
		const elemChanges = this._currState.connectToBoard([...elements]);
		outElements = Actions.applyChangeOnArrayAndActions(elemChanges, out, outElements);
		return {actions: out, elements: outElements};
	}

	private autoMerge(elements: Element[]): { actions: Action[], elements: Element[] } {
		const out: Action[] = [];
		let outElements = [...elements];
		const elemChanges = this._currState.mergeToBoard([...elements]);
		outElements = Actions.applyChangeOnArrayAndActions(elemChanges, out, outElements);
		return {actions: out, elements: outElements};
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

	get version(): number {
		return this._version;
	}

	set version(value: number) {
		this._version = value;
	}
}
