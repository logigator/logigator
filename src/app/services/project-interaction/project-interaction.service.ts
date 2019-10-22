import {Injectable, NgZone} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {ProjectsService} from '../projects/projects.service';
import {SelectionService} from '../selection/selection.service';
import {CopyService} from '../copy/copy.service';
import {WorkModeService} from '../work-mode/work-mode.service';
import {checkActionUsable} from '../../models/action-usable-in-modes';
import {OpenProjectComponent} from '../../components/popup/popup-contents/open/open-project.component';
import {PopupService} from '../popup/popup.service';
import {NewComponentComponent} from '../../components/popup/popup-contents/new-component/new-component.component';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {ShareProjectComponent} from '../../components/popup/popup-contents/share-project/share-project.component';

@Injectable({
	providedIn: 'root'
})
export class ProjectInteractionService {

	public static staticInstance: ProjectInteractionService;

	private _zoomNotifierSubject = new Subject<'in' | 'out' | '100'>();
	private _deleteNotifierSubject = new Subject<void>();
	private _pasteNotifierSubject = new Subject<void>();

	constructor(
		private projectsService: ProjectsService,
		private selection: SelectionService,
		private copy: CopyService,
		private workMode: WorkModeService,
		private popupService: PopupService,
		private projectSave: ProjectSaveManagementService,
		private ngZone: NgZone
	) {
		ProjectInteractionService.staticInstance = this;
	}

	public zoomIn() {
		if (!checkActionUsable('zoomIn')) return;
		this._zoomNotifierSubject.next('in');
	}

	public zoomOut() {
		if (!checkActionUsable('zoomOut')) return;
		this._zoomNotifierSubject.next('out');
	}

	public zoom100() {
		if (!checkActionUsable('zoom100')) return;
		this._zoomNotifierSubject.next('100');
	}

	public deleteSelection() {
		if (!checkActionUsable('delete')) return;
		this.projectsService.currProject.removeElementsById(this.selection.selectedIds());
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
		this._deleteNotifierSubject.next();
	}

	public copySelection() {
		if (!checkActionUsable('copy')) return;
		this.copy.copySelection();
	}

	public cutSelection() {
		if (!checkActionUsable('cut')) return;
		this.copy.copySelection();
		this.projectsService.currProject.removeElementsById(this.selection.selectedIds());
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
		this._deleteNotifierSubject.next();
	}

	public paste() {
		if (!checkActionUsable('paste')) return;
		this.workMode.setWorkMode('select');
		this._pasteNotifierSubject.next();
	}

	public undoForCurrent() {
		if (!checkActionUsable('undo')) return;
		this.projectsService.currProject.stepBack();
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
	}

	public redoForCurrent() {
		if (!checkActionUsable('redo')) return;
		this.projectsService.currProject.stepForward();
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
	}

	public newProject() {
		if (!checkActionUsable('newProj')) return;
		this.ngZone.run(async () => {
			if (await this.projectsService.askToSave()) {
				await this.projectsService.newProject();
			}
		});
	}

	public async openProject() {
		if (!checkActionUsable('openProj')) return;
		await this.ngZone.run(async () => {
			if (await this.projectsService.askToSave()) {
				await this.popupService.showPopup(OpenProjectComponent, 'POPUP.OPEN.TITLE', true);
			}
		});
	}

	public newComponent(): Promise<any> {
		if (!checkActionUsable('newComp')) return;
		return this.ngZone.run(() => {
			return this.popupService.showPopup(NewComponentComponent, 'POPUP.NEW_COMP.TITLE', false);
		});
	}

	public shareProject(): Promise<any> {
		return this.ngZone.run(() => {
			return this.popupService.showPopup(
				ShareProjectComponent,
				'POPUP.SHARE.TITLE',
				false,
				null,
				{project: this.projectsService.mainProject.name}
			);
		});
	}

	public exportToFile(): Promise<void> {
		return this.projectSave.exportToFile(this.projectsService.mainProject);
	}

	public saveAll() {
		this.ngZone.run(() => this.projectsService.saveAll());
	}

	public get onZoomChangeClick$(): Observable<'in' | 'out' | '100'> {
		return this._zoomNotifierSubject.asObservable();
	}

	public get onElementsDelete$(): Observable<void> {
		return this._deleteNotifierSubject.asObservable();
	}

	public get onPaste$(): Observable<void> {
		return this._pasteNotifierSubject.asObservable();
	}
}
