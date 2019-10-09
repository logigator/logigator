import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
// #!project_recorder
import {Test} from '../../../../tests/auto-tests/tests';
// #!project_recorder
import {ManuallyLogged} from '../../../../tests/auto-tests/board-recorder';
import {PopupService} from '../../services/popup/popup.service';
import {NewComponentComponent} from '../popup/popup-contents/new-component/new-component.component';
import {OpenProjectComponent} from '../popup/popup-contents/open/open-project.component';
import {Observable} from 'rxjs';
import {tap} from 'rxjs/operators';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent {

	// #!project_recorder
	private test: Test;

	constructor(
		private workModeService: WorkModeService,
		private projectService: ProjectsService,
		private projectInteraction: ProjectInteractionService,
		private popupService: PopupService
	) {}

	// #!if DEBUG === 'true'
	public printElements(): void {
		this.projectService.currProject.allElements.forEach(console.log);
	}
	// #!endif

	// #!if PROJECT_RECORDER === 'true'
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

	public undo(): void {
		this.projectInteraction.redoForCurrent();
	}

	public redo(): void {
		this.projectInteraction.undoForCurrent();
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
