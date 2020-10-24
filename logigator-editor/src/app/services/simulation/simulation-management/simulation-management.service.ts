import {Inject, Injectable} from '@angular/core';
import {
	WorkerCommunicationService,
	WorkerCommunicationServiceModel
} from '../worker-communication/worker-communication-service-model';
import {RenderTicker} from '../../render-ticker/render-ticker.service';

@Injectable({
	providedIn: 'root'
})
export class SimulationManagementService {

	private _targetMode = false;

	private _syncMode = false;

	private _targetTickRate = 1;

	private _threadCount = 1;

	constructor(
		@Inject(WorkerCommunicationService) private workerCommunication: WorkerCommunicationServiceModel,
		private renderTicker: RenderTicker
	) {}

	public async enterSimulation() {
		await this.workerCommunication.init();
	}

	public leaveSimulation() {
		this.renderTicker.stopAllContSim();
		this.workerCommunication.stop();
	}

	public continueSim(override = false) {
		if (!override && this.simulationRunning)
			return;

		if (this._targetMode) {
			this.workerCommunication.startTarget();
		} else if (this._syncMode) {
			this.workerCommunication.startSync();
		} else {
			this.workerCommunication.start(this._threadCount);
		}

		this.renderTicker.startAllContSim();
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

		if (this.simulationRunning)
			this.continueSim(true);
	}

	public toggleSyncMode() {
		this._syncMode = !this._syncMode;
		if (this._syncMode)
			this._targetMode = false;

		if (this.simulationRunning)
			this.continueSim(true);
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
		if (!this._threadCount)
			return;

		this._threadCount = threadCount;

		if (this._threadCount < 1)
			this._threadCount = 1;
		if (this._threadCount > 512)
			this._threadCount = 512;

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
}
