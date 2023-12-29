import {Component, OnInit, ViewChild, ViewContainerRef} from '@angular/core';
import {PopupContentComp} from '../../popup/popup-content-comp';
import {UntypedFormBuilder, UntypedFormGroup, Validators} from '@angular/forms';
import {ImageExportService} from '../../../services/image-export/image-export.service';
import {FileSaverService} from '../../../services/file-saver/file-saver.service';
import {ProjectsService} from '../../../services/projects/projects.service';
import {ThemingService} from '../../../services/theming/theming.service';
import {Theme} from '../../../services/image-export/svg-image-exporter';
import {LoadingService} from '../../../services/loading/loading.service';
import * as PIXI from 'pixi.js';

@Component({
	selector: 'app-image-export',
	templateUrl: './image-export.component.html',
	styleUrls: ['./image-export.component.scss']
})
export class ImageExportComponent extends PopupContentComp implements OnInit {

	public form: UntypedFormGroup;

	@ViewChild('loadingRef', {read: ViewContainerRef, static: true})
	private _loadingRef: ViewContainerRef;

	constructor(
		private formBuilder: UntypedFormBuilder,
		private imageExporter: ImageExportService,
		private fileSaverService: FileSaverService,
		private projectService: ProjectsService,
		private themingService: ThemingService,
		private loadingService: LoadingService
	) {
		super();
	}

	ngOnInit(): void {
		this.form = this.formBuilder.group({
			transparent: [],
			customDimensions: [],
			dimensionX: ['', [
				Validators.required,
				Validators.min(1),
				Validators.max(15_000)
			]],
			dimensionY: ['', [
				Validators.required,
				Validators.min(1),
				Validators.max(15_000)
			]]
		});
	}

	isInvalid() {
		return this.form.controls['customDimensions'].value && this.form.invalid;
	}

	async generate(type: 'svg' | 'png' | 'jpeg') {
		let size: PIXI.Point;
		const loadingRemove = this.loadingService.add('LOADING.GENERATING_IMAGE', this._loadingRef, true);

		if (this.form.controls['customDimensions'].value) {
			size = new PIXI.Point(
				this.form.controls['dimensionX'].value,
				this.form.controls['dimensionY'].value
			);
		}

		const theme = this.themingService.currentTheme === 'dark' ?
			(this.form.controls['transparent'].value ? Theme.Dark_Transparent : Theme.Dark) :
			(this.form.controls['transparent'].value ? Theme.Light_Transparent : Theme.Light);

		try {
			if (type === 'svg') {
				await this.fileSaverService.saveLocalFile(
					this.imageExporter.generateSVG(this.projectService.currProject, {
						size,
						theme
					}), 'svg', this.projectService.currProject.name, 'Save Image As'
				);
			} else {
				await this.fileSaverService.saveLocalFileBlob(
					await this.imageExporter.generateImage(this.projectService.currProject, type as any, {
						size,
						theme
					}), type === 'jpeg' ? 'jpg' : type, this.projectService.currProject.name, 'Save Image As'
				);
			}
		} finally {
			loadingRemove();
		}
	}
}
