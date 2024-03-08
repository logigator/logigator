import { Inject, Injectable, NgZone } from '@angular/core';
import {
	WorkerCommunicationService,
	WorkerCommunicationServiceModel
} from '../worker-communication/worker-communication-service-model';
import { RenderTicker } from '../../render-ticker/render-ticker.service';
import {
	StorageService,
	StorageServiceModel
} from '../../storage/storage.service';

@Injectable({
	providedIn: 'root'
})
export class SimulationManagementService {
	private _targetMode = false;

	private _syncMode = true;

	private _targetTickRate = 1;

	private _threadCount = 1;

	private _autoStartSimulation: boolean;

	constructor(
		@Inject(WorkerCommunicationService)
		private workerCommunication: WorkerCommunicationServiceModel,
		@Inject(StorageService) private storage: StorageServiceModel,
		private renderTicker: RenderTicker,
		private ngZone: NgZone
	) {
		this._autoStartSimulation =
			(this.storage.get('autoStartSim') ?? 'true') === 'true';
	}

	public async enterSimulation() {
		await this.workerCommunication.init();
		if (this._autoStartSimulation) this.continueSim();
	}

	public leaveSimulation() {
		this.renderTicker.stopAllContSim();
		this.workerCommunication.stop();
	}

	public continueSim(override = false) {
		if (!override && this.simulationRunning) return;

		if (this._targetMode) {
			this.workerCommunication.startTarget();
		} else if (this._syncMode) {
			this.workerCommunication.startSync();
		} else {
			this.workerCommunication.start(this._threadCount);
		}

		this.ngZone.runOutsideAngular(() => this.renderTicker.startAllContSim());
	}

	public pauseSim() {
		this.renderTicker.stopAllContSim();
		this.workerCommunication.pause();
	}

	public stopSim() {
		this.renderTicker.stopAllContSim();
		this.workerCommunication.stop();
	}

	public singleStepSim() {
		this.workerCommunication.singleStep();
	}

	public toggleTargetMode() {
		this._targetMode = !this._targetMode;
		if (this._targetMode) {
			this.setTarget(this._targetTickRate);
			this._syncMode = false;
		}

		if (this.simulationRunning) this.continueSim(true);
	}

	public toggleSyncMode() {
		this._syncMode = !this._syncMode;
		if (this._syncMode) this._targetMode = false;

		if (this.simulationRunning) this.continueSim(true);
	}

	public setTarget(target: number) {
		this._targetTickRate = target;
		this.workerCommunication.setTarget(this._targetTickRate);
	}

	public get simulationStatus() {
		return this.workerCommunication.status;
	}

	public get simulationRunning() {
		return this.workerCommunication.isRunning;
	}

	public setThreadCount(threadCount: number) {
		if (!this._threadCount) return;

		this._threadCount = threadCount;

		if (this._threadCount < 1) this._threadCount = 1;
		if (this._threadCount > 512) this._threadCount = 512;

		if (this.simulationRunning) {
			this.workerCommunication.pause();
			this.continueSim();
		}
	}

	get targetMode(): boolean {
		return this._targetMode;
	}

	get syncMode(): boolean {
		return this._syncMode;
	}

	get threadCount(): number {
		return this._threadCount;
	}

	public get autoStartSimulation(): boolean {
		return this._autoStartSimulation;
	}

	public set autoStartSimulation(start: boolean) {
		this._autoStartSimulation = start;
		this.storage.set('autoStartSim', start);
	}
}
