import { Pipe, PipeTransform } from '@angular/core';

/**
 * This is just a placeholder for now. We will implement hashing later.
 */

@Pipe({
	standalone: true,
	name: 'hashed'
})
export class HashedPipe implements PipeTransform {
	// TODO: Implement hashing at build
	private hash: string = Math.random().toString(36).substring(7);

	constructor() {}

	public transform(uri: string): string {
		const separator = uri.indexOf('?') === -1 ? '?' : '&';
		return `${uri}${separator}v=${this.hash}`;
	}
}
