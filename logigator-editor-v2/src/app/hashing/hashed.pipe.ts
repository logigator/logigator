import { Pipe, PipeTransform, inject } from '@angular/core';
import { HashingService } from './hashing.service';

@Pipe({
	standalone: true,
	name: 'hashed'
})
export class HashedPipe implements PipeTransform {
	private readonly hashingService = inject(HashingService);

	public transform(uri: string): string {
		return this.hashingService.hashUrl(uri);
	}
}
