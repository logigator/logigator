// @ts-strict-ignore
import { Injectable } from '@angular/core';
import { StorageServiceModel } from './storage.service';

@Injectable({
	providedIn: 'root'
})
export class LocalStorageService extends StorageServiceModel {
	public get(key: string): string | unknown {
		const data = localStorage.getItem(key);
		try {
			return JSON.parse(data);
		} catch (e) {
			return data;
		}
	}

	public set(key: string, data: unknown) {
		localStorage.setItem(
			key,
			typeof data === 'string' ? data : JSON.stringify(data)
		);
	}

	public remove(key: string) {
		localStorage.removeItem(key);
	}

	public has(key: string): boolean {
		return !!localStorage.getItem(key);
	}
}
