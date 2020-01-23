import {Component, DoCheck, ElementRef, Inject, NgZone, OnDestroy, OnInit, Renderer2, ViewChild} from '@angular/core';
import {ThemingService} from './services/theming/theming.service';
import {SelectionService} from './services/selection/selection.service';
import {WorkModeService} from './services/work-mode/work-mode.service';
import {ShortcutsService} from './services/shortcuts/shortcuts.service';
import {fromEvent, Subject} from 'rxjs';
import {DOCUMENT} from '@angular/common';
import {takeUntil} from 'rxjs/operators';
import {ProjectsService} from './services/projects/projects.service';
import {LangChangeEvent, TranslateService} from '@ngx-translate/core';
import {ElementProviderService} from './services/element-provider/element-provider.service';
import {ProjectInteractionService} from './services/project-interaction/project-interaction.service';

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
		private theming: ThemingService,
		private workMode: WorkModeService,
		private selection: SelectionService,
		private shortcuts: ShortcutsService,
		private projects: ProjectsService,
		private projectInteractionService: ProjectInteractionService,
		@Inject(DOCUMENT) private document: HTMLDocument,
		private translate: TranslateService,
		private elementProviderService: ElementProviderService
	) {
		this.setGoogleAnalytics();
		this.initTranslation();
	}

	ngOnInit(): void {
		this.ngZone.runOutsideAngular(() => {
			this.listenToShortcuts();

			this.theming.onRequestFullscreen$.pipe(
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
			this.shortcuts.keyDownListener(e);
		});
	}

	public get isSimulationMode(): boolean {
		return this.workMode.currentWorkMode === 'simulation';
	}

	public get showSettingsInfoBox(): boolean {
		const seElTypeId = this.selectedElemTypeId;
		return seElTypeId === undefined ? false : this.elementProviderService.getElementById(seElTypeId).showSettings;
	}

	public get selectedElemTypeId(): number {
		if (this.workMode.currentWorkMode === 'buildComponent') {
			return this.workMode.currentComponentToBuild;
		} else {
			const selectedIds = this.selection.selectedIds();
			if (!selectedIds || selectedIds.length === 0 || selectedIds.length > 1) {
				return undefined;
			}
			const elemType = this.projects.currProject.currState.getElementById(this.selection.selectedIds()[0]);
			if (!elemType) return undefined;
			return elemType.typeId;
		}
	}

	public get selectedCompId(): number {
		if (!this.selection.selectedIds() || this.workMode.currentWorkMode === 'buildComponent') {
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

	private onFileDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		this.projectInteractionService.openProjectDrop(event.dataTransfer.files)
	}

	private initTranslation() {
		this.translate.addLangs(['en', 'de']);
		const lang = window.localStorage.getItem('lang');
		if (lang) {
			this.translate.setDefaultLang(lang);
			this.translate.use(lang);
		} else {
			this.translate.setDefaultLang('en');
			this.translate.use('en');
		}
		this.translate.onLangChange.subscribe((e: LangChangeEvent) => {
			window.localStorage.setItem('lang', e.lang);
		});
	}

	private setGoogleAnalytics() {
		// #!electron
		gtag('config', 'UA-151071040-3', { page_path: 'electron' });

		// #!web
		gtag('config', 'UA-151071040-3', { page_path: 'web' });
	}

	ngOnDestroy(): void {
		this._destroySubject.next();
		this._destroySubject.unsubscribe();
	}
}
