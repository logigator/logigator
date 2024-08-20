import { Injectable } from '@angular/core';
import { Assets } from 'pixi.js';
import { HashingService } from '../hashing/hashing.service';

@Injectable({
	providedIn: 'root'
})
export class AssetsService {
	constructor(private readonly hashingService: HashingService) {
		Assets.add({
			alias: 'Roboto',
			src: hashingService.hashUrl('fonts/roboto-regular-webfont.woff2')
		});
	}

	async init() {
		await Assets.load(['Roboto']);
	}
}
