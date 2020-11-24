import {Component, ElementRef, Inject, NgZone, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import {SelectionService} from './services/selection/selection.service';
import {WorkModeService} from './services/work-mode/work-mode.service';
import {fromEvent, Subject} from 'rxjs';
import {DOCUMENT} from '@angular/common';
import {takeUntil} from 'rxjs/operators';
import {ProjectsService} from './services/projects/projects.service';
import {LangChangeEvent, TranslateService} from '@ngx-translate/core';
import {ElementProviderService} from './services/element-provider/element-provider.service';
import {ShortcutsService} from './services/shortcuts/shortcuts.service';
import {WorkMode} from './models/work-modes';
import {EditorInteractionService} from './services/editor-interaction/editor-interaction.service';
import {EditorAction} from './models/editor-action';
import {StorageService, StorageServiceModel} from './services/storage/storage.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

	@ViewChild('appRoot', {static: true})
	private appRoot: ElementRef<HTMLDivElement>;

	private _destroySubject = new Subject<void>();

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone,
		private workMode: WorkModeService,
		private selection: SelectionService,
		private shortcutsService: ShortcutsService,
		private projects: ProjectsService,
		private editorInteractionService: EditorInteractionService,
		@Inject(DOCUMENT) private document: HTMLDocument,
		private translate: TranslateService,
		private elementProviderService: ElementProviderService,
		@Inject(StorageService) private storage: StorageServiceModel,
	) {
		this.initTranslation();
	}

	ngOnInit(): void {
		this.ngZone.runOutsideAngular(() => {
			this.listenToShortcuts();

			this.editorInteractionService.subscribeEditorAction(EditorAction.FULLSCREEN).pipe(
				takeUntil(this._destroySubject)
			).subscribe(_ => this.onRequestFullscreen());
		});
		fromEvent(window, 'beforeunload').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e) => this.onTabClose(e as Event));
	}

	private listenToShortcuts() {
		fromEvent(this.document, 'keydown').pipe(
			takeUntil(this._destroySubject)
		).subscribe((e: KeyboardEvent) => {
			this.shortcutsService.keyDownListener(e);
		});
	}

	public get isSimulationMode(): boolean {
		return this.workMode.currentWorkMode ===  WorkMode.SIMULATION;
	}

	public get showSettingsInfoBox(): boolean {
		const seElTypeId = this.selectedElemTypeId;
		return seElTypeId === undefined ? false : this.elementProviderService.getElementById(seElTypeId).showSettings;
	}

	public get selectedElemTypeId(): number {
		if (this.workMode.currentWorkMode ===  WorkMode.COMPONENT) {
			return this.workMode.currentComponentToBuild;
		} else {
			const selectedIds = this.selection.selectedIds();
			if (!selectedIds || selectedIds.length === 0 || selectedIds.length > 1) {
				return undefined;
			}
			const elemType = this.projects.currProject.currState.getElementById(selectedIds[0]);
			if (!elemType) return undefined;
			return elemType.typeId;
		}
	}

	public get selectedCompId(): number {
		if (!this.selection.selectedIds() || this.workMode.currentWorkMode === WorkMode.COMPONENT) {
			return undefined;
		}
		return this.selection.selectedIds()[0];
	}

	private onRequestFullscreen() {
		const elem = this.appRoot.nativeElement as any;
		if (elem.requestFullscreen) {
			elem.requestFullscreen();
		} else if (elem.mozRequestFullScreen) { /* Firefox */
			elem.mozRequestFullScreen();
		} else if (elem.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
			elem.webkitRequestFullscreen();
		} else if (elem.msRequestFullscreen) { /* IE/Edge */
			elem.msRequestFullscreen();
		}
	}

	private onTabClose(e: Event) {
		// #!if DEBUG === 'false' && ELECTRON === 'false'
		if (this.projects.hasUnsavedProjects) {
			e.preventDefault();
			e.returnValue = true;
		}
		// #!endif
	}

	public onDragStart(event: Event) {
		event.preventDefault();
		event.stopPropagation();
	}

	public onDragStop(event: Event) {
		event.preventDefault();
		event.stopPropagation();
	}

	public onFileDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		this.editorInteractionService.openProjectFile(event.dataTransfer.files[0]);
	}

	private initTranslation() {
		this.translate.addLangs(['en', 'de']);
		const lang = this.storage.get('preferences')?.lang;
		if (lang) {
			this.translate.setDefaultLang(lang);
			this.translate.use(lang);
		} else {
			this.translate.setDefaultLang('en');
			this.translate.use('en');
		}
		this.translate.onLangChange.subscribe((e: LangChangeEvent) => {
			this.storage.set('preferences', {
				...this.storage.get('preferences'),
				lang: e.lang
			});
		});
	}

	ngOnDestroy(): void {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}
}
