import {Inject, Injectable} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {EditorColorKey, EditorColors, Theme} from '../../models/theming';
import {Observable, Subject} from 'rxjs';
import {EastereggService} from '../easteregg/easteregg.service';
import {CookieStorageService} from '../cookie-storage/cookie-storage.service';

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
			selectTint: 0xd1d1d1,
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
			fontTint: 0xFFFFFF,
			ledOn: 0x27AE60,
			ledOff: 0x18592d
		}
	};

	constructor(
		@Inject(DOCUMENT) private document: HTMLDocument,
		private eastereggs: EastereggService,
		private storage: CookieStorageService
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

	public getEditorColor(key: EditorColorKey): number {
		return this._editorColor[this._currentTheme][key];
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
