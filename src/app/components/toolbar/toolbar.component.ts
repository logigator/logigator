import {Component} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
// #!debug
import {Test} from '../../../../tests/auto-tests/tests';
// #!debug
import {ManuallyLogged} from '../../../../tests/auto-tests/board-recorder';
import {PopupService} from '../../services/popup/popup.service';
import {NewComponentComponent} from '../popup/popup-contents/new-component/new-component.component';
import {OpenProjectComponent} from '../popup/popup-contents/open/open-project.component';
import {StateCompilerService} from '../../services/simulation/state-compiler/state-compiler.service';

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
		private popupService: PopupService,
		private stateCompiler: StateCompilerService
	) {}

	// #!if DEBUG === 'true'
	public printElements(): void {
		this.projectService.currProject.allElements.forEach(console.log);
	}

	public printCalls(): void {
		console.log(this.projectService.currProject.boardRecorder.stringify());
	}

	public runTests(): void {
		// this.test = new Test('bugfix', this.projectService.currProject, ManuallyLogged.reducedCrash);
		for (const name in ManuallyLogged) {
			Test.runAndCheck(name, false);
		}
	}

	public runStep(): void {
		for (let i = 0; i < 2000; i++) {
			this.test.runStep(true);
		}
	}
	// #!endif

	public setWorkMode(mode: WorkMode) {
		this.workModeService.setWorkMode(mode);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public async newComponent() {
		this.popupService.showPopup(NewComponentComponent, 'POPUP.NEW_COMP.TITLE', false);
	}

	public async undo() {
		console.log(await this.stateCompiler.compile(this.projectService.currProject));
		return;
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
		this.projectService.saveAll();
	}

	public async open() {
		if (await this.projectService.askToSave()) {
			this.popupService.showPopup(OpenProjectComponent, 'POPUP.OPEN.TITLE', true);
		}
	}
}
