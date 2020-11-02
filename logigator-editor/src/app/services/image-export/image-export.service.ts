import {Injectable, Optional} from '@angular/core';
import {ProjectsService} from '../projects/projects.service';
import {SvgImageExporter} from './svg-image-exporter';
import * as PIXI from 'pixi.js';

@Injectable({
	providedIn: 'root'
})
export class ImageExportService {

	constructor(
		private projectsService: ProjectsService
	) { }

	public generateImage(type: 'jpeg' | 'png', options?: {size?: PIXI.Point; theme?: 'dark' | 'light'}): Promise<Blob> {
		return this.getBlobImage(new SvgImageExporter(this.projectsService.currProject, new PIXI.Point(1024, 1024), options?.theme), type);
	}

	public generateSVG(options?: {size?: PIXI.Point; theme?: 'dark' | 'light'}): string {
		const exporter = new SvgImageExporter(this.projectsService.currProject, new PIXI.Point(1024, 1024), options?.theme);
		return exporter.serializeSVG();
	}

	private getBlobImage(exporter: SvgImageExporter, type: 'jpeg' | 'png'): Promise<Blob> {
		const img = new Image();
		const canvas = document.createElement('canvas') as HTMLCanvasElement;

		canvas.width = Math.round(exporter.size.x * exporter.scaleFactor);
		canvas.height = Math.round(exporter.size.y * exporter.scaleFactor);

		return new Promise<Blob>(resolve => {
			img.onload = () => {
				canvas.getContext('2d')
					.drawImage(img, 0, 0, exporter.size.x, exporter.size.y, 0, 0, canvas.width, canvas.height);

				canvas.toBlob(blob => resolve(blob), `image/${type}`);
			};
			img.src = exporter.getBase64String();
		});
	}
}
