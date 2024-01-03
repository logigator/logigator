// @ts-strict-ignore
import {
	Component,
	ElementRef,
	Inject,
	NgZone,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { fromEvent, Subject } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { takeUntil } from 'rxjs/operators';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
import {
	StorageService,
	StorageServiceModel
} from './services/storage/storage.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
	@ViewChild('appRoot', { static: true })
	private appRoot: ElementRef<HTMLDivElement>;

	private _destroySubject = new Subject<void>();

	constructor(
		private ngZone: NgZone,
		@Inject(DOCUMENT) private document: HTMLDocument,
		private translate: TranslateService,
		@Inject(StorageService) private storage: StorageServiceModel
	) {
		this.initTranslation();
	}

	ngOnInit(): void {
		this.document.documentElement.lang = this.translate.currentLang;
		this.ngZone.runOutsideAngular(() => {
			this.listenToShortcuts();

			// this.editorInteractionService
			// 	.subscribeEditorAction(EditorAction.FULLSCREEN)
			// 	.pipe(takeUntil(this._destroySubject))
			// 	.subscribe(() => this.onRequestFullscreen());
		});
		fromEvent(window, 'beforeunload')
			.pipe(takeUntil(this._destroySubject))
			.subscribe((e) => this.onTabClose(e as Event));
	}

	private listenToShortcuts() {
		// fromEvent(this.document, 'keydown')
		// 	.pipe(takeUntil(this._destroySubject))
		// 	.subscribe((e: KeyboardEvent) => {
		// 		this.shortcutsService.keyDownListener(e);
		// 	});
	}

	public get isSimulationMode(): boolean {
		// return this.workMode.currentWorkMode === WorkMode.SIMULATION;
		return false;
	}

	public get showSettingsInfoBox(): boolean {
		// const seElTypeId = this.selectedElemTypeId;
		// return seElTypeId === undefined
		// 	? false
		// 	: this.elementProviderService.getElementById(seElTypeId).showSettings;
		return false;
	}

	public get selectedElemTypeId(): number {
		return undefined;
	}

	public get selectedCompId(): number {
		return undefined;
	}

	private onRequestFullscreen() {
		const elem = this.appRoot.nativeElement;
		if (elem.requestFullscreen) {
			elem.requestFullscreen();
		} else if (elem['mozRequestFullScreen']) {
			/* Firefox */
			elem['mozRequestFullScreen']();
		} else if (elem['webkitRequestFullscreen']) {
			/* Chrome, Safari & Opera */
			elem['webkitRequestFullscreen']();
		} else if (elem['msRequestFullscreen']) {
			/* IE/Edge */
			elem['msRequestFullscreen']();
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	private onTabClose(e: Event) {
		// if (environment.production && this.projects.hasUnsavedProjects) {
		// 	e.preventDefault();
		// 	e.returnValue = true;
		// }
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
		// this.editorInteractionService.openProjectFile(event.dataTransfer.files[0]);
	}

	private initTranslation() {
		this.translate.addLangs(['en', 'de']);
		const lang = this.storage.get<{lang: string}>('preferences')?.lang;
		if (lang) {
			this.translate.setDefaultLang(lang);
			this.translate.use(lang);
		} else {
			this.translate.setDefaultLang('en');
			this.translate.use('en');
		}
		this.translate.onLangChange.subscribe((e: LangChangeEvent) => {
			this.storage.set('preferences', {
				...this.storage.get<object>('preferences'),
				lang: e.lang
			});
		});
	}

	ngOnDestroy(): void {
		this._destroySubject.next(null);
		this._destroySubject.unsubscribe();
	}
}
