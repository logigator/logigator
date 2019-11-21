import { Injectable } from '@angular/core';
import {ProjectsService} from '../projects/projects.service';
import * as PIXI from 'pixi.js';
import {SvgImageExporter} from './svg-image-exporter';
import * as FileSaver from 'file-saver';

@Injectable({
	providedIn: 'root'
})
export class ImageExportService {

	constructor(private projectsService: ProjectsService) { }

	public exportImage(type: 'jpeg' | 'png' | 'svg') {
		if (type === 'jpeg' || type === 'png') {
			this.exportPixelImage(type);
		} else {
			this.exportVectorImage();
		}
	}

	private exportPixelImage(type: 'jpeg' | 'png', width = 512, height = 512) {
		const project = this.projectsService.currProject;

		const img = new Image();
		const canvas = document.createElement('canvas') as HTMLCanvasElement;
		const exporter = new SvgImageExporter(project);

		canvas.width = width || exporter.width + 1;
		canvas.height = height || exporter.height + 1;

		img.onload = () => {
			canvas.getContext('2d')
				.drawImage(img, 0, 0, exporter.width, exporter.height, 0, 0, width || exporter.width + 1, height || exporter.height + 1);

			canvas.toBlob((x) => {
				FileSaver.saveAs(x, `${project.name}.${type}`);
			}, `image/${type}`);
		};
		img.src = exporter.getBase64String();
	}

	private exportVectorImage() {
		const project = this.projectsService.currProject;
		const exporter = new SvgImageExporter(project);
		FileSaver.saveAs(exporter.getSVGDownloadString(), `${project.name}.svg`);
	}
}
