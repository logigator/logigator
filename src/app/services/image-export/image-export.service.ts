import { Injectable } from '@angular/core';
import {ProjectsService} from '../projects/projects.service';
import * as PIXI from 'pixi.js';
import {PixelImageExporter} from './pixel-image-exporter';
import {SvgImageExporter} from './svg-image-exporter';

@Injectable({
	providedIn: 'root'
})
export class ImageExportService {

	private _renderer: PIXI.Renderer;

	constructor(private projectsService: ProjectsService) { }

	public injectRenderer(renderer: PIXI.Renderer) {
		if (this._renderer) return;
		this._renderer = renderer;
	}

	public exportImage(type: 'jpeg' | 'png' | 'svg') {
		if (type === 'jpeg' || type === 'png') {
			this.exportPixelImage(type);
		} else {
			this.exportVectorImage();
		}
	}

	private exportPixelImage(type: 'jpeg' | 'png') {
		const project = this.projectsService.currProject;
		const exporter = new PixelImageExporter(this._renderer, project);
		const a = document.createElement('a');
		a.href = exporter.getBase64String(type);
		a.download = `${project.name}.${type}`;
		a.click();
	}

	private exportVectorImage() {
		const project = this.projectsService.currProject;
		const exporter = new SvgImageExporter(project);
		console.log(exporter.getSVGDownloadString());
		const a = document.createElement('a');
		a.href = exporter.getSVGDownloadString();
		a.download = `${project.name}.svg`;
		a.click();
	}
}
