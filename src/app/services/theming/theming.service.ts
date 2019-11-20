import {Inject, Injectable} from '@angular/core';
import {DOCUMENT} from '@angular/common';
import {EditorColorKey, EditorColors, Theme} from '../../models/theming';
import {Observable, Subject} from 'rxjs';
import {EastereggService} from '../easteregg/easteregg.service';

@Injectable({
	providedIn: 'root'
})
export class ThemingService {

	private _currentTheme: Theme;

	private _showGrid = true;
	private _showGridChangeSubject = new Subject<boolean>();

	private _requestFullscreenSubject = new Subject<void>();

	private _editorColor: EditorColors = {
		light: {
			background: 0xF5F5F5,
			grid: 0x248945,
			wire: 0x2ED573,
			selectRect: 0,
			selectTint: 0xd1d1d1,
			fontTint: 0
		},
		dark: {
			background: 0x222526,
			grid: 0x1C8045,
			wire: 0x27AE60,
			selectRect: 0,
			selectTint: 0x8a8a8a,
			fontTint: 0xFFFFFF
		}
	};

	constructor(@Inject(DOCUMENT) private document: HTMLDocument, private eastereggs: EastereggService) {
		this.loadTheme();
		this.document.body.classList.add(this.themeClass);
	}

	private loadTheme() {
		this._currentTheme = (localStorage.getItem('theme') || 'dark') as Theme;
		if (this._currentTheme === 'light') {
			this.eastereggs.achieve('BLD');
		}
	}

	public setTheme(theme: Theme) {
		localStorage.setItem('theme', theme);
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
		return (localStorage.getItem('theme') || 'dark') as Theme;
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

	public requestFullscreen() {
		this._requestFullscreenSubject.next();
	}

	public get onRequestFullscreen$(): Observable<void> {
		return this._requestFullscreenSubject.asObservable();
	}
}
