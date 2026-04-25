import { Injectable, inject } from '@angular/core';
import { Assets } from 'pixi.js';
import { HashingService } from '../hashing/hashing.service';

@Injectable({
	providedIn: 'root'
})
export class AssetsService {
	private readonly hashingService = inject(HashingService);

	constructor() {
		const hashingService = this.hashingService;

		Assets.add({
			alias: 'Roboto',
			src: hashingService.hashUrl('fonts/roboto-regular-webfont.woff2')
		});
	}

	async init() {
		await Assets.load(['Roboto']);
	}
}
