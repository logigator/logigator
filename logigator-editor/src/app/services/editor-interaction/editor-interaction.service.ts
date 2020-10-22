import {Injectable, NgZone} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {ProjectsService} from '../projects/projects.service';
import {SelectionService} from '../selection/selection.service';
import {CopyService} from '../copy/copy.service';
import {WorkModeService} from '../work-mode/work-mode.service';
import {OpenProjectComponent} from '../../components/popup-contents/open/open-project.component';
import {NewComponentComponent} from '../../components/popup-contents/new-component/new-component.component';
import {ProjectSaveManagementService} from '../project-save-management/project-save-management.service';
import {ShareProjectComponent} from '../../components/popup-contents/share-project/share-project.component';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {PopupService} from '../popup/popup.service';
import {EditorAction} from '../../models/editor-action';
import {filter} from 'rxjs/operators';

@Injectable({
	providedIn: 'root'
})
export class EditorInteractionService {

	private _editorActionsSubject = new Subject<EditorAction>();

	private _zoomNotifierSubject = new Subject<'in' | 'out' | '100'>();
	private _deleteNotifierSubject = new Subject<void>();
	private _pasteNotifierSubject = new Subject<void>();
	private _undoOrRedoNotifierSubject = new Subject<void>();

	constructor(
		private projectsService: ProjectsService,
		private selection: SelectionService,
		private copy: CopyService,
		private workMode: WorkModeService,
		private popupService: PopupService,
		private projectSave: ProjectSaveManagementService,
		private errorHandling: ErrorHandlingService,
		private ngZone: NgZone
	) {}

	public triggerEditorAction(action: EditorAction) {
		this._editorActionsSubject.next(action);
	}

	public subscribeEditorAction(action?: EditorAction): Observable<EditorAction> {
		if (!action) {
			return this._editorActionsSubject.asObservable();
		}
		return this._editorActionsSubject.pipe(
			filter(a => a === action)
		);
	}

	public zoomIn() {
		this._zoomNotifierSubject.next('in');
	}

	public zoomOut() {
		this._zoomNotifierSubject.next('out');
	}

	public zoom100() {
		this._zoomNotifierSubject.next('100');
	}

	public deleteSelection() {
		this.projectsService.currProject.removeElementsById(this.selection.selectedIds());
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
		this._deleteNotifierSubject.next();
	}

	public copySelection() {
		this.copy.copySelection();
	}

	public cutSelection() {
		this.copy.copySelection();
		this.projectsService.currProject.removeElementsById(this.selection.selectedIds());
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
		this._deleteNotifierSubject.next();
	}

	public paste() {
		this._pasteNotifierSubject.next();
	}

	public undoForCurrent() {
		this.projectsService.currProject.stepBack();
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
		this._undoOrRedoNotifierSubject.next();
	}

	public redoForCurrent() {
		this.projectsService.currProject.stepForward();
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
		this._undoOrRedoNotifierSubject.next();
	}

	public newProject() {
		this.ngZone.run(async () => {
			if (await this.projectsService.askToSave()) {
				await this.projectsService.newProject();
			}
		});
	}

	public async openProject() {
		await this.ngZone.run(async () => {
			if (await this.projectsService.askToSave()) {
				await this.popupService.showPopup(OpenProjectComponent, 'POPUP.OPEN.TITLE', true);
			}
		});
	}

	public async openProjectDrop(files: FileList) {
		if (files.length !== 1) return ;
		if (files[0].type !== 'application/json') {
			this.errorHandling.showErrorMessage('ERROR.PROJECTS.INVALID_FILE_TYPE');
			return;
		}
		if (await this.projectsService.askToSave()) {
			const reader = new FileReader();
			reader.readAsText(files[0], 'UTF-8');
			reader.onload = (event: any) => {
				this.projectsService.openFile(event.target.result);
			};
		}
	}

	public newComponent(): Promise<any> {
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

	public get onUndoOrRedo$(): Observable<void> {
		return this._undoOrRedoNotifierSubject.asObservable();
	}
}
