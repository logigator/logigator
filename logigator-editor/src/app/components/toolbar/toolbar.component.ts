// @ts-strict-ignore
import { Component, ViewChild, ViewContainerRef } from '@angular/core';
import { ShortcutAction } from '../../models/shortcut-action';
import { ThemingService } from '../../services/theming/theming.service';
import { environment } from '../../../environments/environment';
import { QuadTree } from '../../classes/quad-tree/quad-tree';
import { BoardStatus } from '../../models/simulation-worker/board';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {

	public targetMultiplier = '1';
	public targetTickRate = 1;

	@ViewChild('enterSimulationLoading', { read: ViewContainerRef, static: true })
	private _enterSimulationLoading: ViewContainerRef;

	constructor(
		private themingService: ThemingService
	) {}

	get production(): boolean {
		return environment.production;
	}

	public printElements(): void {
		const quadTree = new QuadTree();
		quadTree.insert({
			x: 0,
			y: 0,
			x2: 2,
			y2: 2
		});
		quadTree.insert({
			x: 64,
			y: 64,
			x2: 96,
			y2: 96
		});

		const iter = quadTree.queryRange(0,0, 128, 128);
		for (const element of iter) {
			console.log(element);
		}
	}

	public printCalls(): void {
	}

	public runTests(): void {
	}

	public runStep(): void {
	}

	public async printBoard() {

	}

	public toggleChunks() {
	}

	public get currentTheme() {
		return this.themingService.currentTheme;
	}

	public setWorkMode(mode: string) {
		switch (mode) {
			case 'SELECT':
				// this.workModeService.setWorkMode(WorkMode.SELECT);
				break;
			case 'CUT_SELECT':
				// this.workModeService.setWorkMode(WorkMode.CUT_SELECT);
				break;
			case 'ERASER':
				// this.workModeService.setWorkMode(WorkMode.ERASER);
				break;
			case 'TEXT':
				// this.workModeService.setWorkMode(WorkMode.TEXT);
				break;
			case 'WIRE':
				// this.workModeService.setWorkMode(WorkMode.WIRE);
				break;
			case 'CONN_WIRE':
				// this.workModeService.setWorkMode(WorkMode.CONN_WIRE);
				break;
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public getShortcut(action: ShortcutAction): string {
		// const text = this.shortcutService.getShortcutTextForAction(action);
		// return text ? ` (${text})` : '';
		return '';
	}

	public enterSimulation() {
		// this.workModeService.enterSimulation(this._enterSimulationLoading);
	}

	public leaveSimulation() {
		// this.workModeService.leaveSimulation(this._enterSimulationLoading);
	}

	public get isSimulationMode(): boolean {
		// return this.workModeService.currentWorkMode === WorkMode.SIMULATION;
		return false;
	}

	public get isSelectMode(): boolean {
		// return this.workModeService.currentWorkMode === WorkMode.SELECT;
		return false;
	}

	public get isCutSelectMode(): boolean {
		// return this.workModeService.currentWorkMode === WorkMode.CUT_SELECT;
		return false;
	}

	public get isEraserMode(): boolean {
		// return this.workModeService.currentWorkMode === WorkMode.ERASER;
		return false;
	}

	public get isTextMode(): boolean {
		// return this.workModeService.currentWorkMode === WorkMode.TEXT;
		return false;
	}

	public get isWireMode(): boolean {
		// return this.workModeService.currentWorkMode === WorkMode.WIRE;
		return false;
	}

	public get isConnWireMode(): boolean {
		// return this.workModeService.currentWorkMode === WorkMode.CONN_WIRE;
		return false;
	}

	public zoomIn() {
		// this.editorInteractionService.zoomIn();
	}

	public zoomOut() {
		// this.editorInteractionService.zoomOut();
	}

	public undo() {
		// this.editorInteractionService.undo();
	}

	public redo() {
		// this.editorInteractionService.redo();
	}

	public copy() {
		// this.editorInteractionService.copy();
	}

	public cut() {
		// this.editorInteractionService.cut();
	}

	public paste() {
		// this.editorInteractionService.paste();
	}

	public delete() {
		// this.editorInteractionService.delete();
	}

	public save() {
		// this.editorInteractionService.saveProject();
	}

	public newComponent() {
		// this.editorInteractionService.newComponent();
	}

	public openProject() {
		// this.editorInteractionService.openProject();
	}

	public continueSim() {
		// this.simulationManagement.continueSim();
	}

	public pauseSim() {
		// this.simulationManagement.pauseSim();
	}

	public stopSim() {
		// this.simulationManagement.stopSim();
	}

	public singleStepSim() {
		// this.simulationManagement.singleStepSim();
	}

	public toggleTargetMode() {
		// this.simulationManagement.toggleTargetMode();
	}

	public toggleSyncMode() {
		// this.simulationManagement.toggleSyncMode();
	}

	public setTarget(): void {
		const target = this.targetTickRate * Number(this.targetMultiplier);
		if (target < 0) this.targetTickRate = 0;
		// this.simulationManagement.setTarget(target);
	}

	public setThreadCount(): void {
		// this.simulationManagement.setThreadCount(this.threadCount);
	}

	public get simulationStatus(): BoardStatus {
		// return this.simulationManagement.simulationStatus;
		return null;
	}

	public get simulationRunning(): boolean {
		// return this.simulationManagement.simulationRunning;
		return false;
	}

	get targetMode(): boolean {
		// return this.simulationManagement.targetMode;
		return false;
	}

	get syncMode(): boolean {
		// return this.simulationManagement.syncMode;
		return false;
	}

	protected readonly environment = environment;
}
