import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class LocalStorageService {

	constructor() {}

	public get(key: string): any {
		const data = localStorage.getItem(key);
		try {
			return JSON.parse(data);
		} catch (e) {
			return data;
		}
	}

	public set(key: string, data: any) {
		localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
	}

	public remove(key: string) {
		localStorage.removeItem(key);
	}

	public has(key: string): boolean {
		return !!localStorage.getItem(key);
	}
}
