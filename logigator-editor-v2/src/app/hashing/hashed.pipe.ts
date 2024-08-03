import { Pipe, PipeTransform } from '@angular/core';

/**
 * This is just a placeholder for now. We will implement hashing later.
 */

@Pipe({
	standalone: true,
	name: 'hashed'
})
export class HashedPipe implements PipeTransform {
	constructor() {}

	public transform(filePath: string): string {
		return filePath;
	}
}
