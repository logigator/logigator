import { Injectable } from '@angular/core';
import { StorageServiceModel } from './storage.service';

@Injectable({
	providedIn: 'root'
})
export class LocalStorageService extends StorageServiceModel {
	public get<T = unknown>(key: string): T | null {
		const data = localStorage.getItem(key);
		if (!data) return null;

		try {
			return JSON.parse(data);
		} catch {
			return null;
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
