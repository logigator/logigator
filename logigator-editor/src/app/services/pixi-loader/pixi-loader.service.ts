import {Injectable} from '@angular/core';
import {Observable, ReplaySubject} from 'rxjs';
import * as PIXI from 'pixi.js';

@Injectable({
	providedIn: 'root'
})
export class PixiLoaderService {

	private _loaded = false;

	private _loaded$ = new ReplaySubject<void>(1);

	public loadPixiFont() {
		if (this._loaded === true) return;
		this._loaded = true;
		const loader = PIXI.Loader.shared;
		loader.add('Roboto', 'assets/bitmap-fonts/roboto.fnt')
			.add('DSEG14', 'assets/bitmap-fonts/dseg14.fnt')
			.add('DSEG7', 'assets/bitmap-fonts/dseg7.fnt')
			.load(() => {
				this._loaded$.next();
			});
	}

	get loaded$(): Observable<void> {
		return this._loaded$.asObservable();
	}
}
