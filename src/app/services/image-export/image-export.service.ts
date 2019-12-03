import { Injectable } from '@angular/core';
import {ProjectsService} from '../projects/projects.service';
import {SvgImageExporter} from './svg-image-exporter';
import * as FileSaver from 'file-saver';
import {Project} from '../../models/project';

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

	private async exportPixelImage(type: 'jpeg' | 'png') {
		const project = this.projectsService.currProject;
		const blob = await this.getBlobImage(project, type);
		FileSaver.saveAs(blob, `${project.name}.${type}`);
	}

	private getBlobImage(project: Project, type: 'jpeg' | 'png'): Promise<Blob> {
		const img = new Image();
		const canvas = document.createElement('canvas') as HTMLCanvasElement;
		const exporter = new SvgImageExporter(project);

		canvas.width = exporter.width;
		canvas.height = exporter.height;

		return new Promise<Blob>(resolve => {
			img.onload = () => {
				canvas.getContext('2d')
					.drawImage(img, 0, 0, exporter.width, exporter.height, 0, 0, exporter.width, exporter.height);

				canvas.toBlob(blob => resolve(blob), `image/${type}`);
			};
			img.src = exporter.getBase64String();
		});
	}

	private exportVectorImage() {
		const project = this.projectsService.currProject;
		const exporter = new SvgImageExporter(project);
		FileSaver.saveAs(exporter.getSVGDownloadString(), `${project.name}.svg`);
	}
}
