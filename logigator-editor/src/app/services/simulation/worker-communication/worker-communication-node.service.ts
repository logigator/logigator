import {Injectable, NgZone} from '@angular/core';
import {Observable, Subject, timer} from 'rxjs';
import {PowerChangesOutWire} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {Element} from '../../../models/element';
import {BoardState, BoardStatus, InputEvent} from '../../../models/simulation/board';
import {takeWhile} from 'rxjs/operators';
import {ErrorHandlingService} from '../../error-handling/error-handling.service';
import {CompileError} from '../../../models/simulation/error';
import {ElementProviderService} from '../../element-provider/element-provider.service';
import {AverageBuffer} from '../../../models/average-buffer';
import {ElementTypeId} from '../../../models/element-types/element-type-ids';
import {EastereggService} from '../../easteregg/easteregg.service';
import {WorkerCommunicationServiceModel} from './worker-communication-service';
// #!electron
import {Board, logicsim, InputEvent as SimInputEvent} from '@logigator/logigator-simulation';

@Injectable()
export class WorkerCommunicationNodeService implements WorkerCommunicationServiceModel {

	private _powerSubjectsWires: Map<string, Subject<PowerChangesOutWire>>;
	private _powerSubjectsWireEnds: Map<string, Subject<Map<Element, boolean[]>>>;
	private _ioComponentsResetSubject: Map<string, Subject<void>>;

	private _initialized = false;
	private _mode: 'continuous' | 'target' | 'sync';
	private _frameAverage = new AverageBuffer(5);

	private _targetSpeed = 0;
	private _targetLastRun = Date.now();
	private _targetUnprocessedFraction = 0;

	private _dataCache: boolean[];
	private _compiledBoard: Board;

	private _status: BoardStatus = {
		tick: 0,
		componentCount: 0,
		linkCount: 0,
		speed: 0,
		state: BoardState.Uninitialized
	};

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService,
		private ngZone: NgZone,
		private errorHandling: ErrorHandlingService,
		private elementProvider: ElementProviderService,
		private eastereggs: EastereggService
	) {
		this._powerSubjectsWires = new Map<string, Subject<PowerChangesOutWire>>();
		this._powerSubjectsWireEnds = new Map<string, Subject<Map<Element, boolean[]>>>();
		this._ioComponentsResetSubject = new Map<string, Subject<void>>();
	}

	public getWireState(identifier: string, data?: boolean[]): Map<Element, boolean> {
		if (!data)
			data = this._dataCache;
		const out = new Map<Element, boolean>();
		if (!this.stateCompiler.wiresOnLinks.has(identifier))
			return out;
		for (const [link, wires] of this.stateCompiler.wiresOnLinks.get(identifier).entries()) {
			for (const wire of wires) {
				out.set(wire, data[link]);
			}
		}
		return out;
	}

	public getWireEndState(identifier: string, data?: boolean[]): Map<Element, boolean[]> {
		if (!data)
			data = this._dataCache;
		const out = new Map<Element, boolean[]>();
		if (!this.stateCompiler.wireEndsOnLinks.has(identifier))
			return out;
		for (const [link, wireEndOnComps] of this.stateCompiler.wireEndsOnLinks.get(identifier).entries()) {
			for (const wireEndOnComp of wireEndOnComps) {
				const elem = wireEndOnComp.component;
				if (!out.has(elem))
					out.set(elem, new Array(elem.numInputs + elem.numOutputs));
				out.get(elem)[wireEndOnComp.wireIndex] = data[link];

			}
		}
		return out;
	}

	public async init(): Promise<void> {
		const project = this.projectsService.mainProject;

		try {
			const compiledBoard = await this.stateCompiler.compile(project);
			if (!compiledBoard) {
				this.errorHandling.showErrorMessage('ERROR.COMPILE.FAILED');
				return;
			}
			if (compiledBoard.length > 100_000) {
				this.eastereggs.achieve('GBOGH');
			}
			this._compiledBoard = {
				components: compiledBoard,
				links: this.stateCompiler.highestLinkId + 1
			} as Board;
			logicsim.destroy();
			logicsim.init(this._compiledBoard);
			this._initialized = true;
		} catch (e) {
			// #!debug
			console.error(e);
			if (!this.elementProvider.hasElement(e.comp) || !this.elementProvider.hasElement(e.src)) return;
			e.comp = this.elementProvider.getElementById(e.comp).name;
			e.src = this.elementProvider.getElementById(e.src).name;
			this.errorHandling.showErrorMessage((e as CompileError).name, e);
			throw e;
		}
	}

	public stop(): void {
		if (!this._initialized)
			return;

		this._mode = undefined;
		logicsim.destroy();
		logicsim.init(this._compiledBoard);
		this.updateSubjects();
		for (const resetSubject of this._ioComponentsResetSubject.values()) {
			resetSubject.next();
		}
	}

	public pause(): void {
		if (!this._initialized)
			return;

		logicsim.stop();
		this._mode = undefined;
		this.updateSubjects();
	}

	public start(threads = 1): void {
		if (!this._initialized || this._mode === 'continuous')
			return;

		this._mode = 'continuous';
		this.registerStatusWatch();

		logicsim.start(threads);
	}

	public startTarget(target?: number): void {
		if (!this._initialized || this._mode === 'target')
			return;

		if (target && target >= 0)
			this._targetSpeed = target;

		this.pause();
		this._mode = 'target';
		this.registerStatusWatch();
	}

	public startSync(): void {
		if (!this._initialized || this._mode === 'sync')
			return;

		this.pause();
		this._mode = 'sync';
		this.registerStatusWatch();
		this.singleStep();
	}

	public setTarget(target: number) {
		if (target >= 0)
			this._targetSpeed = target;
	}

	private registerStatusWatch() {
		const mode = this._mode;

		this.ngZone.runOutsideAngular(() => {
			timer(0, 1000).pipe(
				takeWhile(() => mode === this._mode),
			).subscribe(x => {
				this.updateStatus();
			});
		});
	}

	private updateStatus() {
		const status = logicsim.getStatus();
		this._status = {
			tick: status.tick,
			speed: status.currentSpeed,
			state: status.currentState,
			componentCount: status.componentCount,
			linkCount: status.linkCount
		} as BoardStatus;
	}

	public singleStep(): void {
		logicsim.start(1, 1, Number.MAX_SAFE_INTEGER, true);
		this.updateSubjects();
	}

	private updateSubjects() {
		const state = logicsim.getLinks();
		this._dataCache = state;
		const powerChangesWire = new Map<string, PowerChangesOutWire>();
		const powerChangesWireEnds = new Map<string, Map<Element, boolean[]>>();
		for (const identifier of this._powerSubjectsWires.keys()) {
			powerChangesWire.set(identifier, this.getWireState(identifier, state));
			powerChangesWireEnds.set(identifier, this.getWireEndState(identifier, state));
		}
		for (const projId of this._powerSubjectsWires.keys()) {
			this._powerSubjectsWires.get(projId).next(powerChangesWire.get(projId));
			this._powerSubjectsWireEnds.get(projId).next(powerChangesWireEnds.get(projId));
		}
	}

	public setFrameTime(frameTime: number): void {
		this._frameAverage.push(frameTime > this._frameAverage.average + 100 ? this._frameAverage.average + 100 : frameTime);
		if (!this._initialized)
			return;

		if (this._mode === 'sync') {
			logicsim.start(1, 1, Number.MAX_SAFE_INTEGER, true);
		} else if (this._mode === 'target') {
			const timestamp = Date.now();
			const ticks = ((timestamp - this._targetLastRun) * this._targetSpeed / 1000) + this._targetUnprocessedFraction;
			const ticksToCompute = Math.trunc(ticks);

			if (ticksToCompute) {
				this._targetUnprocessedFraction = ticks % 1;
				logicsim.start(1, ticksToCompute, this._frameAverage.average);
				this._targetLastRun = timestamp;
			}
		}

		if (this._mode)
			this.updateSubjects();
	}

	public setUserInput(identifier: string, element: Element, state: boolean[]): void {
		const index = this.stateCompiler.ioElemIndexes.get(identifier).get(element.id);
		let inputEvent: InputEvent;
		if (element.typeId === ElementTypeId.BUTTON) {
			inputEvent = InputEvent.Pulse;
		} else if (element.typeId === ElementTypeId.LEVER) {
			inputEvent = InputEvent.Cont;
		}
		logicsim.triggerInput(index, inputEvent as unknown as SimInputEvent, state);
	}

	public boardStateWires(projectId: string): Observable<PowerChangesOutWire> {
		return this._powerSubjectsWires.get(projectId).asObservable();
	}

	public boardStateWireEnds(projectId: string): Observable<Map<Element, boolean[]>> {
		return this._powerSubjectsWireEnds.get(projectId).asObservable();
	}

	onIoCompReset(projectId: string): Observable<void> {
		return this._ioComponentsResetSubject.get(projectId).asObservable();
	}

	public get status(): BoardStatus {
		return this._status;
	}

	public get isRunning() {
		return !!this._mode;
	}

	public subscribe(identifier: string): void {
		if (!this._powerSubjectsWires.has(identifier)) {
			this._powerSubjectsWires.set(identifier, new Subject<PowerChangesOutWire>());
			this._powerSubjectsWireEnds.set(identifier, new Subject<Map<Element, boolean[]>>());
			this._ioComponentsResetSubject.set(identifier, new Subject<void>());
		}
	}

	public unsubscribe(identifier: string): void {
		this._powerSubjectsWires.delete(identifier);
		this._powerSubjectsWireEnds.delete(identifier);
		this._ioComponentsResetSubject.delete(identifier);
	}
}
