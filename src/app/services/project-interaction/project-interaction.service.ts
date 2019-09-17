import { Injectable } from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {ProjectsService} from '../projects/projects.service';
import {SelectionService} from '../selection/selection.service';

@Injectable({
	providedIn: 'root'
})
export class ProjectInteractionService {

	public static staticInstance: ProjectInteractionService;

	private _zoomNotifierSubject = new Subject<'in' | 'out'>();
	private _deleteNotifierSubject = new Subject<void>();

	constructor(private projectsService: ProjectsService, private selection: SelectionService) {
		ProjectInteractionService.staticInstance = this;
	}

	public zoomIn() {
		this._zoomNotifierSubject.next('in');
	}

	public zoomOut() {
		this._zoomNotifierSubject.next('out');
	}

	public deleteSelection() {
		this.projectsService.currProject.removeElementsById(this.selection.selectedIds());
		this._deleteNotifierSubject.next();
	}

	public get onZoomChangeClick$(): Observable<'in' | 'out'> {
		return  this._zoomNotifierSubject.asObservable();
	}

	public get onElementsDelete$(): Observable<void> {
		return this._deleteNotifierSubject.asObservable();
	}
}
