// @ts-strict-ignore
import { Injectable } from '@angular/core';
import { SvgImageExporter, Theme } from './svg-image-exporter';
import * as PIXI from 'pixi.js';
import { Project } from '../../models/project';

@Injectable({
	providedIn: 'root'
})
export class ImageExportService {
	constructor() {}

	public async generatePreviews(project: Project) {
		const exporter = new SvgImageExporter(
			project,
			new PIXI.Point(1024, 1024),
			Theme.Dark_Transparent
		);
		const dark = await this.getBlobImage(exporter, 'png');
		exporter.changeTheme(Theme.Light_Transparent);
		return {
			dark,
			light: await this.getBlobImage(exporter, 'png')
		};
	}

	public generateImage(
		project: Project,
		type: 'jpeg' | 'png',
		options?: { size?: PIXI.Point; theme?: Theme }
	): Promise<Blob> {
		return this.getBlobImage(
			new SvgImageExporter(project, options?.size, options?.theme),
			type
		);
	}

	public generateSVG(
		project: Project,
		options?: { size?: PIXI.Point; theme?: Theme }
	): string {
		const exporter = new SvgImageExporter(
			project,
			options?.size,
			options?.theme
		);
		return exporter.serializeSVG();
	}

	private getBlobImage(
		exporter: SvgImageExporter,
		type: 'jpeg' | 'png'
	): Promise<Blob> {
		const img = new Image();
		const canvas = document.createElement('canvas') as HTMLCanvasElement;

		canvas.width = Math.round(exporter.size.x * exporter.scaleFactor);
		canvas.height = Math.round(exporter.size.y * exporter.scaleFactor);

		return new Promise<Blob>((resolve) => {
			img.onload = () => {
				canvas
					.getContext('2d')
					.drawImage(
						img,
						0,
						0,
						exporter.size.x,
						exporter.size.y,
						0,
						0,
						canvas.width,
						canvas.height
					);

				canvas.toBlob((blob) => resolve(blob), `image/${type}`);
			};
			img.src = exporter.getBase64String();
		});
	}
}
