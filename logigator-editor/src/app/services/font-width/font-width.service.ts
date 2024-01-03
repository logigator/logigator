import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

@Injectable({
	providedIn: 'root'
})
export class FontWidthService {
	private readonly canvas: HTMLCanvasElement | null = null;

	constructor(
		@Inject(PLATFORM_ID) private platformId: string,
		@Inject(DOCUMENT) private document: Document
	) {
		if (!isPlatformBrowser(this.platformId)) return;

		this.canvas = document.createElement('canvas');
	}

	public getTextWidth(text: string, font?: string): number {
		if (!this.canvas) return 1;

		const context = this.canvas.getContext('2d');
		if (!context) return 1;

		context.font = font || window.getComputedStyle(this.document.body).font;
		return context.measureText(text).width;
	}
}
