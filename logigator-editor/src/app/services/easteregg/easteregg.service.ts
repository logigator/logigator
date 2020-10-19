import { Injectable } from '@angular/core';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {LocalStorageService} from '../local-storage/local-storage.service';

@Injectable({
	providedIn: 'root'
})
export class EastereggService {

	private _done: Set<string>;

	constructor(private errorHandling: ErrorHandlingService, private storage: LocalStorageService) {
		const data = this.storage.get('sneaks');
		this._done = data ? new Set(data) : new Set<string>();
	}

	public achieve(name: string) {
		if (!this._done || this._done.has(name))
			return;
		this._done.add(name);
		this.errorHandling.showInfo('INFO.EASTEREGGS.' + name);
		this.storage.set('sneaks', [...this._done]);
	}
}
