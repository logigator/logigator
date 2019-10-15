import { Injectable } from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {ProjectsService} from '../projects/projects.service';
import {SelectionService} from '../selection/selection.service';
import {CopyService} from '../copy/copy.service';
import {WorkModeService} from '../work-mode/work-mode.service';

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
		private workMode: WorkModeService
	) {
		ProjectInteractionService.staticInstance = this;
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
		this.workMode.setWorkMode('select');
		this._pasteNotifierSubject.next();
	}

	public undoForCurrent() {
		this.projectsService.currProject.stepBack();
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
	}

	public redoForCurrent() {
		this.projectsService.currProject.stepForward();
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject.id);
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
