import {
	ChangeDetectionStrategy,
	Component,
	effect,
	ElementRef,
	input,
	NgZone,
	OnDestroy,
	OnInit,
	output,
	signal,
	ViewChild
} from '@angular/core';
import { Application, Point } from 'pixi.js';
import { ThemingService } from '../../theming/theming.service';
import { Project } from '../../project/project';
import { AssetsService } from '../../rendering/assets.service';
import { merge, Subject, takeUntil, throttleTime } from 'rxjs';
import { WorkModeService } from '../../work-mode/work-mode.service';

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
	protected readonly canvas!: ElementRef<HTMLCanvasElement>;

	public readonly positionChange = output<Point>();
	public readonly project = input<Project | null>(null);

	protected readonly loaded = signal(false);

	private readonly destroy$ = new Subject<void>();
	private readonly projectChange$ = new Subject<Project | null>();

	private readonly app: Application = new Application();

	constructor(
		private readonly hostEl: ElementRef,
		private readonly themingService: ThemingService,
		private readonly ngZone: NgZone,
		private readonly assetsService: AssetsService,
		private readonly workModeService: WorkModeService
	) {
		this.projectChange$.pipe(takeUntil(this.destroy$)).subscribe((project) => {
			if (!project) {
				return;
			}

			this.ngZone.runOutsideAngular(() => {
				project.resizeViewport(
					this.app.renderer.width,
					this.app.renderer.height
				);

				this.app.stage = project;
				this.app.ticker.update();

				this.positionChange.emit(project.gridPosition);

				project.positionChange$
					.pipe(
						takeUntil(merge(this.destroy$, this.projectChange$)),
						throttleTime(33.33)
					)
					.subscribe((pos) => {
						this.positionChange.emit(pos);
					});

				project.ticker$
					.pipe(takeUntil(merge(this.destroy$, this.projectChange$)))
					.subscribe((value) => {
						switch (value) {
							case 'single':
								this.app.ticker.update();
								break;
							case 'on':
								this.app.ticker.start();
								break;
							case 'off':
								this.app.ticker.update();
								this.app.ticker.stop();
								break;
						}
					});
			});
		});

		effect(() => {
			if (!this.loaded()) {
				return;
			}

			this.projectChange$.next(this.project());
		});

		effect(() => {
			const project = this.project();
			if (!project) {
				return;
			}

			project.mode = this.workModeService.mode();
			project.componentToPlace = this.workModeService.selectedComponentConfig();
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
				const project = this.project();
				if (!project) {
					return;
				}

				project.resizeViewport(w, h);
			});

			this.loaded.set(true);
		});
	}

	ngOnDestroy(): void {
		this.app.destroy();
		this.destroy$.next();
	}
}
