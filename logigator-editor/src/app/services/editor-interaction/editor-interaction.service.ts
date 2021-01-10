import {Injectable, NgZone} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {ProjectsService} from '../projects/projects.service';
import {SelectionService} from '../selection/selection.service';
import {CopyService} from '../copy/copy.service';
import {EditorAction} from '../../models/editor-action';
import {filter} from 'rxjs/operators';
import {PopupService} from '../popup/popup.service';
import {NewComponentComponent} from '../../components/popup-contents/new-component/new-component.component';
import {OpenProjectComponent} from '../../components/popup-contents/open/open-project.component';
import {SaveAsComponent} from '../../components/popup-contents/save-as/save-as.component';
import {ShareProjectComponent} from '../../components/popup-contents/share-project/share-project.component';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {EditComponentPlugsComponent} from '../../components/popup-contents/edit-component-plugs/edit-component-plugs.component';
import {LoadingService} from '../loading/loading.service';

@Injectable({
	providedIn: 'root'
})
export class EditorInteractionService {

	private _editorActionsSubject = new Subject<EditorAction>();

	constructor(
		private projectsService: ProjectsService,
		private selection: SelectionService,
		private copyService: CopyService,
		private ngZone: NgZone,
		private popupService: PopupService,
		private errorHandling: ErrorHandlingService,
		private loadingService: LoadingService
	) {}

	public subscribeEditorAction(...actions: EditorAction[]): Observable<EditorAction> {
		if (!actions || actions.length === 0) {
			return this._editorActionsSubject.asObservable();
		}
		return this._editorActionsSubject.pipe(
			filter(a => actions.includes(a))
		);
	}

	public zoomIn() {
		this._editorActionsSubject.next(EditorAction.ZOOM_IN);
	}

	public zoomOut() {
		this._editorActionsSubject.next(EditorAction.ZOOM_OUT);
	}

	public zoom100() {
		this._editorActionsSubject.next(EditorAction.ZOOM_100);
	}

	public delete() {
		this.projectsService.currProject.removeElementsById(this.selection.selectedIds());
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject);
		this._editorActionsSubject.next(EditorAction.DELETE);
	}

	public copy() {
		this.copyService.copySelection();
		this._editorActionsSubject.next(EditorAction.COPY);
	}

	public cut() {
		this.copyService.copySelection();
		this.projectsService.currProject.removeElementsById(this.selection.selectedIds());
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject);
		this._editorActionsSubject.next(EditorAction.CUT);
	}

	public paste() {
		this._editorActionsSubject.next(EditorAction.PASTE);
	}

	public undo() {
		this.projectsService.currProject.stepBack();
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject);
		this._editorActionsSubject.next(EditorAction.UNDO);
	}

	public redo() {
		this.projectsService.currProject.stepForward();
		this.projectsService.inputsOutputsCustomComponentChanged(this.projectsService.currProject);
		this._editorActionsSubject.next(EditorAction.REDO);
	}

	public editCustomComponentPlugs() {
		const projectToEdit = this.projectsService.currProject;
		this.popupService.showPopup(EditComponentPlugsComponent, 'POPUP.EDIT_COMPONENT_PLUGS.TITLE', false, projectToEdit);
	}

	public fullscreen() {
		this._editorActionsSubject.next(EditorAction.FULLSCREEN);
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
				const openResp = await this.popupService.showPopup(OpenProjectComponent, 'POPUP.OPEN.TITLE', true);
				if (!openResp)
					return;

				switch (openResp.type) {
					case 'server':
						this.projectsService.openProjectUuid(openResp.data);
						break;
					case 'local':
						this.openProjectFile(openResp.data);
						break;
					case 'share':
						this.projectsService.openShare(openResp.data);
						break;
				}
			}
		});
	}

	public async saveProject() {
		if (this.projectsService.mainProject.source !== 'local') {
			this.projectsService.saveAllProjects();
		} else {
			const saveResp = await this.popupService.showPopup(SaveAsComponent, 'POPUP.SAVE.TITLE', true);
			if (!saveResp)
				return;

			switch (saveResp.target) {
				case 'server':
					this.projectsService.saveProjectServer(saveResp.name, saveResp.description, saveResp.public);
					break;
				case 'local':
					this.exportToFile(saveResp.name);
			}
		}
	}

	public async openProjectFile(file: File) {
		if (file.type !== 'application/json') {
			this.errorHandling.showErrorMessage('ERROR.PROJECTS.INVALID_FILE_TYPE');
			return;
		}
		if (await this.projectsService.askToSave()) {
			const removeLoading = this.loadingService.add('LOADING.OPENING_FILE');
			const reader = new FileReader();
			reader.readAsText(file, 'UTF-8');
			reader.onload = async (event: any) => {
				await this.projectsService.openFile(event.target.result);
				removeLoading();
			};
		}
	}

	public newComponent() {
		return this.ngZone.run(async () => {
			const compConfig = await this.popupService.showPopup(NewComponentComponent, 'POPUP.NEW_COMP.TITLE', false);
			if (compConfig) {
				const removeLoading = this.loadingService.add('LOADING.CREATE_COMPONENT');
				await this.projectsService.createComponent(compConfig.name, compConfig.symbol, compConfig.description, compConfig.public);
				removeLoading();
			}
		});
	}

	public shareProject() {
		this.ngZone.run(() => {
			this.popupService.showPopup(
				ShareProjectComponent,
				'POPUP.SHARE.TITLE',
				false,
				this.projectsService.mainProject,
				{project: this.projectsService.mainProject.name}
			);
		});
	}

	public async exportToFile(name?: string) {
		const removeLoading = this.loadingService.add('LOADING.EXPORT_FILE');
		await this.projectsService.exportToFile(name);
		removeLoading();
	}
}
