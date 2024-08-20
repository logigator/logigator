import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	NgZone,
	OnDestroy,
	OnInit,
	signal,
	ViewChild
} from '@angular/core';
import { Application } from 'pixi.js';
import { ThemingService } from '../../theming/theming.service';
import { Project } from '../../rendering/project';
import { AssetsService } from '../../rendering/assets.service';

@Component({
	selector: 'app-board',
	standalone: true,
	imports: [],
	templateUrl: './board.component.html',
	styleUrl: './board.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardComponent implements OnInit, OnDestroy {
	@ViewChild('canvas', { static: true }) readonly canvas!: ElementRef<HTMLCanvasElement>;

	private readonly app: Application = new Application();
	private readonly project = new Project();

	protected readonly loaded = signal(false);

	constructor(
		private readonly hostEl: ElementRef,
		private readonly themingService: ThemingService,
		private readonly ngZone: NgZone,
		private readonly assetsService: AssetsService
	) {}

	async ngOnInit(): Promise<void> {
		await this.assetsService.init();

		await this.ngZone.runOutsideAngular(async () => {
			await this.app.init({
				canvas: this.canvas.nativeElement,
				resizeTo: this.hostEl.nativeElement,
				preference: 'webgpu',
				antialias: true,
				hello: true,
				powerPreference: 'high-performance',
				backgroundColor: this.themingService.currentTheme().background,
				resolution: window.devicePixelRatio || 1,
				autoDensity: true,
				autoStart: false
			});

			this.app.renderer.on('resize', (w, h) => {
				this.project.resizeViewport(w, h);
			});

			this.project.resizeViewport(this.app.renderer.width, this.app.renderer.height);
			this.app.stage = this.project;

			this.app.ticker.start();

			this.loaded.set(true);
		});
	}

	ngOnDestroy(): void {
		this.app.destroy();
	}
}
