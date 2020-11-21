import {Inject, Injectable} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {EditorColorKey, EditorColors, Theme} from '../../models/theming';
import {Observable, Subject} from 'rxjs';
import {EastereggService} from '../easteregg/easteregg.service';
import {StorageService, StorageServiceModel} from '../storage/storage.service';

@Injectable({
	providedIn: 'root'
})
export class ThemingService {

	private _currentTheme: Theme;
	private _pendingTheme: Theme;

	private _showGrid = true;
	private _showGridChangeSubject = new Subject<boolean>();

	private _editorColor: EditorColors = {
		light: {
			background: 0xF5F5F5,
			grid: 0x0,
			wire: 0x0,
			selectRect: 0,
			selectTint: 0xD0D0D0,
			wireSelectColor: 0xB0B0B0,
			fontTint: 0,
			ledOn: 0x27AE60,
			ledOff: 0x0
		},
		dark: {
			background: 0x222526,
			grid: 0x1C8045,
			wire: 0x27AE60,
			selectRect: 0,
			selectTint: 0x8a8a8a,
			wireSelectColor: 0x0F5E36,
			fontTint: 0xFFFFFF,
			ledOn: 0x27AE60,
			ledOff: 0x18592d
		}
	};

	constructor(
		@Inject(DOCUMENT) private document: HTMLDocument,
		private eastereggs: EastereggService,
		@Inject(StorageService) private storage: StorageServiceModel,
	) {
		this.loadTheme();
	}

	public loadTheme() {
		this._currentTheme = this.storage.get('preferences')?.theme as Theme ?? 'dark';
		this._pendingTheme = this.currentTheme;
		if (this._currentTheme === 'light') {
			setTimeout(() => this.eastereggs.achieve('BLD'), 1000);
		}
		this.document.body.classList.add(this.themeClass);
	}

	public setTheme(theme: Theme) {
		this._pendingTheme = theme;
		this.storage.set('preferences', {
			...this.storage.get('preferences'),
			theme
		});
	}

	public get themeClass(): string {
		return 'theme-' + this._currentTheme;
	}

	public getEditorColor(key: EditorColorKey, theme?: Theme): number {
		return this._editorColor[theme ?? this._currentTheme][key];
	}

	public get currentTheme(): Theme {
		return this._currentTheme;
	}

	public get pendingTheme(): Theme {
		return this._pendingTheme;
	}

	public get showGrid(): boolean {
		return this._showGrid;
	}

	public set showGrid(value: boolean) {
		this._showGrid = value;
		this._showGridChangeSubject.next(value);
	}

	public get showGridChanges$(): Observable<boolean> {
		return this._showGridChangeSubject.asObservable();
	}
}
