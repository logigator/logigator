import {Component, Inject} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
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
		private stateCompiler: StateCompilerService
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

	public setWorkMode(mode: WorkMode) {
		this.workModeService.setWorkMode(mode);
	}

	public enterSim() {
		this.workModeService.enterSimulation();
	}

	public leaveSim() {
		this.renderTicker.stopAllContSim();
		this.workModeService.leaveSimulation();
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public async newComponent() {
		this.projectInteraction.newComponent();
	}

	public async undo() {
		this.projectInteraction.undoForCurrent();
	}

	public redo(): void {
		this.projectInteraction.redoForCurrent();
	}

	public zoomIn() {
		this.projectInteraction.zoomIn();
	}

	public zoomOut() {
		this.projectInteraction.zoomOut();
	}

	public delete() {
		this.projectInteraction.deleteSelection();
	}

	public copy() {
		this.projectInteraction.copySelection();
	}

	public cut() {
		this.projectInteraction.cutSelection();
	}

	public paste() {
		this.projectInteraction.paste();
	}

	public save() {
		this.projectInteraction.saveAll();
	}

	public async open() {
		this.projectInteraction.openProject();
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
