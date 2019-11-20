import { Injectable } from '@angular/core';
import {ErrorHandlingService} from '../error-handling/error-handling.service';

@Injectable({
	providedIn: 'root'
})
export class EastereggService {

	private readonly done: Set<string>;

	constructor(private errorHandling: ErrorHandlingService) {
		const item = localStorage.getItem('sneaks');
		this.done = item && item.length > 0 ? new Set(JSON.parse(item)) : new Set<string>();
	}

	public achieve(name: string) {
		if (this.done.has(name))
			return;
		this.done.add(name);
		this.errorHandling.showInfo(name);
		localStorage.setItem('sneaks', JSON.stringify([...this.done]));
	}
}
