import { Injectable } from '@angular/core';
import {ProjectsService} from '../projects/projects.service';
import * as PIXI from 'pixi.js';
import {ImageExporter} from './ImageExporter';

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

	public exportImage(type: 'jpeg' | 'png') {
		const project = this.projectsService.currProject;
		const exporter = new ImageExporter(this._renderer, project);
		const a = document.createElement('a');
		a.href = exporter.getBase64String(type);
		a.download = `${project.name}.${type}`;
		a.click();
	}
}
