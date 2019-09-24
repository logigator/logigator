import {Component, OnInit} from '@angular/core';
import {WorkMode} from '../../models/work-modes';
import {WorkModeService} from '../../services/work-mode/work-mode.service';
import {ProjectsService} from '../../services/projects/projects.service';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {CopyService} from '../../services/copy/copy.service';
import {SelectionService} from '../../services/selection/selection.service';

@Component({
	selector: 'app-toolbar',
	templateUrl: './toolbar.component.html',
	styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {

	constructor(
		private workModeService: WorkModeService,
		private projectService: ProjectsService,
		private projectInteraction: ProjectInteractionService,
		private copyService: CopyService
	) { }

	ngOnInit() {
	}

	public printElements(): void {
		console.log(this.projectService.currProject.allElements);
	}

	private printWires(): void {
		console.log('wires');
		for (const elem of this.projectService.currProject.allElements) {
			if (elem.typeId === 0) {
				console.log(elem.id, elem.pos, elem.endPos);
			}
		}
		console.log('connectionPoints');
		for (const chunks of this.projectService.currProject.currState.chunks) {
			for (const chunk of chunks) {
				if (!chunk)
					continue;
				for (const cp of chunk.connectionPoints) {
					console.log(cp);
				}
			}
		}
	}

	public test(): void {
		CopyService.staticInstance.copyIds(SelectionService.staticInstance.selectedIds());
	}

	public test1(): void {
		this.projectService.currProject.addElements(CopyService.staticInstance.copiedElements);
		this.printWires();
	}

	public setWorkMode(mode: WorkMode) {
		this.workModeService.setWorkMode(mode);
	}

	public get currentWorkMode(): WorkMode {
		return this.workModeService.currentWorkMode;
	}

	public undo(): void {
		this.projectService.currProject.stepBack();
	}

	public redo(): void {
		this.projectService.currProject.stepForward();
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
}
