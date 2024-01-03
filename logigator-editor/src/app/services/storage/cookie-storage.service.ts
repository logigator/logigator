import { Injectable } from '@angular/core';
import { StorageServiceModel } from './storage.service';

@Injectable({
	providedIn: 'root'
})
export class CookieStorageService extends StorageServiceModel {
	public get<T = unknown>(key: string): T | null {
		if (!this.has(key)) return null;

		const cookieValue = document.cookie
			.split('; ')
			.find((row) => row.startsWith(key))
			?.split('=')[1];

		if (!cookieValue) return null;

		try {
			const decoded = decodeURIComponent(cookieValue);
			if (decoded.startsWith('j:')) {
				return JSON.parse(decoded.substring(2));
			}
			return decoded as T;
		} catch {
			return null;
		}
	}

	public set(key: string, data: unknown) {
		let toSave: string;
		if (typeof data === 'object') {
			toSave = `j:${JSON.stringify(data)}`;
		} else {
			toSave = String(data);
		}
		const date = new Date();
		date.setTime(date.getTime() + 30 * 24 * 60 * 60 * 1000);
		document.cookie = `${key}=${encodeURIComponent(
			toSave
		)};expires=${date.toUTCString()};path=/`;
	}

	public remove(key: string) {
		const date = new Date();
		date.setTime(date.getTime() - 24 * 60 * 60 * 1000);
		document.cookie = `${key}=;expires=${date.toUTCString()};path=/`;
	}

	public has(key: string): boolean {
		return document.cookie
			.split(';')
			.some((item) => item.trim().startsWith(key + '='));
	}
}
