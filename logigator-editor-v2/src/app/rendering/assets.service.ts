import { Injectable, inject } from '@angular/core';
import { Assets } from 'pixi.js';
import { HashingService } from '../hashing/hashing.service';

@Injectable({
	providedIn: 'root'
})
export class AssetsService {
	private readonly hashingService = inject(HashingService);

	constructor() {
		if (!Assets.resolver.hasKey('Roboto')) {
			Assets.add({
				alias: 'Roboto',
				src: this.hashingService.hashUrl('fonts/roboto-regular-webfont.woff2')
			});
		}
	}

	async init() {
		await Assets.load(['Roboto']);
	}
}
