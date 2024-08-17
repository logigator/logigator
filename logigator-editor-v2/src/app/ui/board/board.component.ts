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

@Component({
	selector: 'app-board',
	standalone: true,
	imports: [],
	templateUrl: './board.component.html',
	styleUrl: './board.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoardComponent implements OnInit, OnDestroy {
	@ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

	private app!: Application;

	protected loaded = signal(false);

	constructor(
		private readonly hostEl: ElementRef,
		private readonly themingService: ThemingService,
		private readonly ngZone: NgZone
	) {}

	async ngOnInit(): Promise<void> {
		await this.ngZone.runOutsideAngular(async () => {
			this.app = new Application();

			await this.app.init({
				canvas: this.canvas.nativeElement,
				resizeTo: this.hostEl.nativeElement,
				preference: 'webgpu',
				antialias: true,
				hello: true,
				powerPreference: 'high-performance',
				backgroundColor: this.themingService.currentTheme().background,
				resolution: window.devicePixelRatio || 1,
				autoDensity: true
			});
			this.loaded.set(true);

			const test = new Project();
			test.resizeViewport(this.app.screen.width, this.app.screen.height);

			this.app.stage = test;
		});
	}

	ngOnDestroy(): void {
		this.app.destroy();
	}
}
