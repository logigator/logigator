import {Component, Inject} from '@angular/core';
import {ProjectsService} from '../../services/projects/projects.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
// #!debug
import {Test} from '../../../../tests/auto-tests/tests';
// #!debug
import {ManuallyLogged} from '../../../../tests/auto-tests/board-recorder';
import {RenderTicker} from '../../services/render-ticker/render-ticker.service';
import {
	WorkerCommunicationService,
	WorkerCommunicationServiceModel
} from '../../services/simulation/worker-communication/worker-communication-service';
import {StateCompilerService} from '../../services/simulation/state-compiler/state-compiler.service';
import {EditorActionsService} from '../../services/editor-actions/editor-actions.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {WorkMode} from '../../models/work-modes';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {

	// #!debug
	private test: Test;

	public targetMode = false;
	public syncMode = false;

	public targetMultiplier = '1';
	public targetTickRate = 1;

	public threadCount = 1;

	constructor(
		private workModeService: WorkModeService,
		private projectService: ProjectsService,
		private projectInteraction: ProjectInteractionService,
		@Inject(WorkerCommunicationService) private workerCommunication: WorkerCommunicationServiceModel,
		private renderTicker: RenderTicker,
		private stateCompiler: StateCompilerService,
		private editorActions: EditorActionsService
	) {}

	// #!if DEBUG === 'true'
	public printElements(): void {
		console.log(this.projectService.currProject.allElements);
	}

	public printCalls(): void {
		console.log(this.projectService.currProject.boardRecorder.stringify());
	}

	public runTests(): void {
		// this.test = new Test('bugfix', this.projectService.currProject, ManuallyLogged.testTest);
		for (const name in ManuallyLogged) {
			Test.runAndCheck(name, false);
		}
	}

	public runStep(): void {
		this.test.runStep(true);
	}

	public async printBoard() {
		console.log(JSON.stringify({
			components: await this.stateCompiler.compile(this.projectService.currProject),
			links: this.stateCompiler.highestLinkId + 1
		}));
	}
	// #!endif

	public triggerEditorAction(action: string) {
		this.editorActions.triggerAction(action);
	}

	public isActionUsable(action: string): boolean {
		return this.editorActions.isActionUsable(action);
	}

	public get isSimulationMode(): boolean {
		return this.workModeService.currentWorkMode === WorkMode.SIMULATION;
	}

	public get iSelectMode(): boolean {
		return this.workModeService.currentWorkMode === WorkMode.SELECT;
	}

	public get isCutSelectMode(): boolean {
		return this.workModeService.currentWorkMode === WorkMode.CUT_SELECT;
	}

	public get isEraserMode(): boolean {
		return this.workModeService.currentWorkMode === WorkMode.ERASER;
	}

	public get isTextMode(): boolean {
		return this.workModeService.currentWorkMode === WorkMode.TEXT;
	}

	public get isWireMode(): boolean {
		return this.workModeService.currentWorkMode === WorkMode.WIRE;
	}

	public get isConnWireMode(): boolean {
		return this.workModeService.currentWorkMode === WorkMode.CONN_WIRE;
	}

	public continueSm(override = false) {
		if (!override && this.simulationRunning)
			return;

		if (this.targetMode) {
			this.workerCommunication.startTarget();
		} else if (this.syncMode) {
			this.workerCommunication.startSync();
		} else {
			this.workerCommunication.start(this.threadCount);
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
		this.targetMode = !this.targetMode;
		if (this.targetMode) {
			this.setTarget();
			this.syncMode = false;
		}

		if (this.simulationRunning)
			this.continueSm(true);
	}

	public toggleSyncMode() {
		this.syncMode = !this.syncMode;
		if (this.syncMode)
			this.targetMode = false;

		if (this.simulationRunning)
			this.continueSm(true);
	}

	public setTarget() {
		const target = this.targetTickRate * Number(this.targetMultiplier);
		if (target < 0) this.targetTickRate = 0;
		this.workerCommunication.setTarget(target);
	}

	public get simulationStatus() {
		return this.workerCommunication.status;
	}

	public get simulationRunning() {
		return this.workerCommunication.isRunning;
	}

	public setThreadCount() {
		if (!this.threadCount)
			return;

		if (this.threadCount < 1)
			this.threadCount = 1;
		if (this.threadCount > 512)
			this.threadCount = 512;

		if (this.simulationRunning) {
			this.workerCommunication.pause();
			this.continueSm();
		}
	}
}
