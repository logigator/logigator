import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	NgZone,
	OnDestroy,
	OnInit,
	output,
	signal,
	ViewChild
} from '@angular/core';
import { Application, Point } from 'pixi.js';
import { ThemingService } from '../../theming/theming.service';
import { Project } from '../../rendering/project';
import { AssetsService } from '../../rendering/assets.service';
import { Subject, takeUntil, throttleTime } from 'rxjs';

@Component({
	selector: 'app-board',
	standalone: true,
	imports: [],
	templateUrl: './board.component.html',
	styleUrl: './board.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardComponent implements OnInit, OnDestroy {
	@ViewChild('canvas', { static: true })
	readonly canvas!: ElementRef<HTMLCanvasElement>;

	public readonly positionChange = output<Point>();

	private readonly destroy$ = new Subject<void>();

	private readonly app: Application = new Application();
	private readonly project = new Project();

	protected readonly loaded = signal(false);

	constructor(
		private readonly hostEl: ElementRef,
		private readonly themingService: ThemingService,
		private readonly ngZone: NgZone,
		private readonly assetsService: AssetsService
	) {
		this.project.positionChange$
			.pipe(takeUntil(this.destroy$), throttleTime(33.33))
			.subscribe((pos) => {
				this.positionChange.emit(pos);
			});
	}

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

			this.project.resizeViewport(
				this.app.renderer.width,
				this.app.renderer.height
			);
			this.app.stage = this.project;

			this.app.ticker.update();

			this.project.ticker$.pipe(takeUntil(this.destroy$)).subscribe((value) => {
				switch (value) {
					case 'single':
						this.app.ticker.update();
						break;
					case 'on':
						this.app.ticker.start();
						break;
					case 'off':
						this.app.ticker.stop();
						break;
				}
			});

			this.loaded.set(true);
		});
	}

	ngOnDestroy(): void {
		this.app.destroy();
		this.destroy$.next();
	}
}
