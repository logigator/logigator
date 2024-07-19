import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { Assets } from 'pixi.js';

@Injectable({
	providedIn: 'root'
})
export class PixiLoaderService {
	private _loaded$ = new ReplaySubject<void>(1);

	public loadPixiFont() {
		Assets.load([
			'assets/bitmap-fonts/roboto.xml',
			'assets/bitmap-fonts/dseg14.xml',
			'assets/bitmap-fonts/dseg7.xml'
		]).then(() => this._loaded$.next());
	}

	get loaded$(): Observable<void> {
		return this._loaded$.asObservable();
	}
}
