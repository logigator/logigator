import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class HashingService {
	// TODO: Implement hashing at build
	private _hash: string = Math.random().toString(36).substring(7);

	constructor() {}

	public hashUrl(uri: string): string {
		const separator = uri.indexOf('?') === -1 ? '?' : '&';
		return `${uri}${separator}v=${this._hash}`;
	}
}
