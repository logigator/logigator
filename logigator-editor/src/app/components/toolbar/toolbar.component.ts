import {Component, Inject, ViewChild, ViewContainerRef} from '@angular/core';
import {ProjectsService} from '../../services/projects/projects.service';
// #!debug
import {Test} from '../../../../tests/auto-tests/tests';
// #!debug
import {ManuallyLogged} from '../../../../tests/auto-tests/board-recorder';
import {StateCompilerService} from '../../services/simulation/state-compiler/state-compiler.service';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {WorkMode} from '../../models/work-modes';
import {EditorInteractionService} from '../../services/editor-interaction/editor-interaction.service';
import {ShortcutAction} from '../../models/shortcut-action';
import {ShortcutsService} from '../../services/shortcuts/shortcuts.service';
import {SimulationManagementService} from '../../services/simulation/simulation-management/simulation-management.service';
import {Grid} from '../../models/rendering/grid';
import {ThemingService} from '../../services/theming/theming.service';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {

	// #!debug
	private test: Test;

	public targetMultiplier = '1';
	public targetTickRate = 1;

	public threadCount = 1;

	@ViewChild('enterSimulationLoading', {read: ViewContainerRef, static: true})
	private _enterSimulationLoading: ViewContainerRef;

	constructor(
		private workModeService: WorkModeService,
		private projectService: ProjectsService,
		private editorInteractionService: EditorInteractionService,
		private stateCompiler: StateCompilerService,
		private shortcutService: ShortcutsService,
		private simulationManagement: SimulationManagementService,
		private themingService: ThemingService
	) {}

	// #!if DEBUG === 'true'
	public printElements(): void {
		console.log(this.projectService.currProject.allElements);
	}

	public get currentTheme() {
		return this.themingService.currentTheme;
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

	public toggleChunks() {
		Grid.showChunks(!Grid.chunksVisible);
	}
	// #!endif

	public setWorkMode(mode: string) {
		switch (mode) {
			case 'SELECT':
				this.workModeService.setWorkMode(WorkMode.SELECT);
				break;
			case 'CUT_SELECT':
				this.workModeService.setWorkMode(WorkMode.CUT_SELECT);
				break;
			case 'ERASER':
				this.workModeService.setWorkMode(WorkMode.ERASER);
				break;
			case 'TEXT':
				this.workModeService.setWorkMode(WorkMode.TEXT);
				break;
			case 'WIRE':
				this.workModeService.setWorkMode(WorkMode.WIRE);
				break;
			case 'CONN_WIRE':
				this.workModeService.setWorkMode(WorkMode.CONN_WIRE);
				break;
		}
	}

	public getShortcut(action: ShortcutAction): string {
		const text = this.shortcutService.getShortcutTextForAction(action);
		return text ? ` (${text})` : '';
	}

	public enterSimulation() {
		this.workModeService.enterSimulation(this._enterSimulationLoading);
	}

	public leaveSimulation() {
		this.workModeService.leaveSimulation(this._enterSimulationLoading);
	}

	public get isSimulationMode(): boolean {
		return this.workModeService.currentWorkMode === WorkMode.SIMULATION;
	}

	public get isSelectMode(): boolean {
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

	public zoomIn() {
		this.editorInteractionService.zoomIn();
	}

	public zoomOut() {
		this.editorInteractionService.zoomOut();
	}

	public undo() {
		this.editorInteractionService.undo();
	}

	public redo() {
		this.editorInteractionService.redo();
	}

	public copy() {
		this.editorInteractionService.copy();
	}

	public cut() {
		this.editorInteractionService.cut();
	}

	public paste() {
		this.editorInteractionService.paste();
	}

	public delete() {
		this.editorInteractionService.delete();
	}

	public save() {
		this.editorInteractionService.saveProject();
	}

	public newComponent() {
		this.editorInteractionService.newComponent();
	}

	public openProject() {
		this.editorInteractionService.openProject();
	}

	public continueSim() {
		this.simulationManagement.continueSim();
	}

	public pauseSim() {
		this.simulationManagement.pauseSim();
	}

	public stopSim() {
		this.simulationManagement.stopSim();
	}

	public singleStepSim() {
		this.simulationManagement.singleStepSim();
	}

	public toggleTargetMode() {
		this.simulationManagement.toggleTargetMode();
	}

	public toggleSyncMode() {
		this.simulationManagement.toggleSyncMode();
	}

	public setTarget() {
		const target = this.targetTickRate * Number(this.targetMultiplier);
		if (target < 0) this.targetTickRate = 0;
		this.simulationManagement.setTarget(target);
	}

	public setThreadCount() {
		this.simulationManagement.setThreadCount(this.threadCount);
	}

	public get simulationStatus() {
		return this.simulationManagement.simulationStatus;
	}

	public get simulationRunning() {
		return this.simulationManagement.simulationRunning;
	}

	get targetMode(): boolean {
		return this.simulationManagement.targetMode;
	}

	get syncMode(): boolean {
		return this.simulationManagement.syncMode;
	}
}
