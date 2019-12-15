import {Component} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
// #!debug
import {Test} from '../../../../tests/auto-tests/tests';
// #!debug
import {ManuallyLogged} from '../../../../tests/auto-tests/board-recorder';
import {WorkerCommunicationService} from '../../services/simulation/worker-communication/worker-communication.service';
import {RenderTicker} from '../../services/render-ticker/render-ticker.service';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {

	// #!debug
	private test: Test;

	constructor(
		private workModeService: WorkModeService,
		private projectService: ProjectsService,
		private projectInteraction: ProjectInteractionService,
		private workerCommunication: WorkerCommunicationService,
		private renderTicker: RenderTicker
	) {}

	// #!if DEBUG === 'true'
	public printElements(): void {
		console.log(this.projectService.currProject.allElements);
	}

	public printCalls(): void {
		console.log(this.projectService.currProject.boardRecorder.stringify());
	}

	public runTests(): void {
		// this.test = new Test('bugfix', this.projectService.currProject, ManuallyLogged.bug);
		for (const name in ManuallyLogged) {
			Test.runAndCheck(name, false);
		}
	}

	public runStep(): void {
		this.test.runStep(true);
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

	public continueSm() {
		this.workerCommunication.start();
		this.renderTicker.startAllContSim();
	}

	public pauseSim() {
		this.workerCommunication.pause();
		this.renderTicker.stopAllContSim();
	}

	public stopSim() {
		this.workerCommunication.stop();
		this.renderTicker.stopAllContSim();
	}

	public singleStepSim() {
		this.workerCommunication.singleStep();
	}

	public continueSmTarget() {
		this.workerCommunication.startTarget();
		this.renderTicker.startAllContSim();
	}

	public setTarget(event) {
		this.workerCommunication.setTarget(event.target.valueAsNumber);
	}

	public get simulationStatus() {
		return this.workerCommunication.status;
	}

	public get simulationRunning() {
		return this.workerCommunication.isRunning;
	}
}
