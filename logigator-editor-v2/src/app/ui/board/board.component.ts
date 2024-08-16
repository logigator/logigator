import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Application } from 'pixi.js';
import { ThemingService } from '../../theming/theming.service';
import { Project } from '../../rendering/project';

@Component({
	selector: 'app-board',
	standalone: true,
	imports: [],
	templateUrl: './board.component.html',
	styleUrl: './board.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardComponent implements OnInit {
	@ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

	private readonly app: Application = new Application();

	constructor(private readonly hostEl: ElementRef, private readonly themingService: ThemingService) {
	}

	async ngOnInit(): Promise<void> {
		await this.app.init({
			canvas: this.canvas.nativeElement,
			resizeTo: this.hostEl.nativeElement,
			eventFeatures: {
				click: true,
				move: false,
				wheel: false,
				globalMove: false
			},
			preference: 'webgpu',
			antialias: false,
			hello: true,
			powerPreference: 'high-performance',
			backgroundColor: this.themingService.currentTheme().background,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true
		});

		const test = new Project();
		test.resizeViewport(this.app.screen.width, this.app.screen.height);

		this.app.stage.addChild(test);
	}
}
