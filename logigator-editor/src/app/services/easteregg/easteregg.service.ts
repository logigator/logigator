import { Injectable } from '@angular/core';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {StorageService} from '../storage/storage.service';

@Injectable({
	providedIn: 'root'
})
export class EastereggService {

	private done: Set<string>;

	constructor(private errorHandling: ErrorHandlingService, private storage: StorageService) {
		this.storage.get('sneaks').then(item => {
			this.done = item ? new Set(item) : new Set<string>();
		});
	}

	public achieve(name: string) {
		if (!this.done || this.done.has(name))
			return;
		this.done.add(name);
		this.errorHandling.showInfo('INFO.EASTEREGGS.' + name);
		this.storage.set('sneaks', [...this.done]);
	}
}
