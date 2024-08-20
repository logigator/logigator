import { Pipe, PipeTransform } from '@angular/core';
import { HashingService } from './hashing.service';

@Pipe({
	standalone: true,
	name: 'hashed'
})
export class HashedPipe implements PipeTransform {
	constructor(private readonly hashingService: HashingService) {}

	public transform(uri: string): string {
		return this.hashingService.hashUrl(uri);
	}
}
