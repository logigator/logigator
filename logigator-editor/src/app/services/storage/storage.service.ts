import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class StorageService {

	constructor() {}

	public get(key: string): any {
		return undefined;
	}

	public set(key: string, data: any) {
	}

	public remove(key: string) {
	}

	public has(key: string): boolean {
		return true;
	}
}
