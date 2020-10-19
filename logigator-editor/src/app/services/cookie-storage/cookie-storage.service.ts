import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class CookieStorageService {

	constructor() {}

	public get(key: string): any {
		const cookieValue = document.cookie
			.split('; ')
			.find(row => row.startsWith(key))
			.split('=')[1];

		try {
			const decoded = decodeURIComponent(cookieValue);
			if (decoded.startsWith('j:')) {
				return JSON.parse(decoded.substring(2));
			}
			return decoded;
		} catch {
			return undefined;
		}
	}


	public set(key: string, data: any) {
		let toSave: string;
		if (typeof data === 'object') {
			toSave = `j:${JSON.stringify(data)}`;
		} else {
			toSave = data;
		}
		const date = new Date();
		date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000));
		document.cookie = `${key}=${encodeURIComponent(toSave)};expires=${date.toUTCString()};path=/`;
	}

	public remove(key: string) {

	}

	public has(key: string): boolean {
		return document.cookie.split(';').some(item => item.trim().startsWith(key + '='));
	}
}
