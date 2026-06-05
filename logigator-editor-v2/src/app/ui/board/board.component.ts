import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
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
import { filter, merge, Subject, takeUntil, throttleTime } from 'rxjs';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-board',
  imports: [],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative' }
})
export class BoardComponent implements OnInit, OnDestroy {
  private readonly hostEl = inject(ElementRef);
  private readonly themingService = inject(ThemingService);
  private readonly assetsService = inject(AssetsService);
  private readonly workModeService = inject(WorkModeService);

  @ViewChild('canvas', { static: true })
  protected readonly canvas!: ElementRef<HTMLCanvasElement>;

  public readonly positionChange = output<Point>();
  public readonly cursorPositionChange = output<Point>();
  public readonly project = input<Project | null>(null);

  protected readonly loaded = signal(false);
  protected readonly fps = environment.debug.fpsCounter ? signal(0) : null;

  private readonly destroy$ = new Subject<void>();
  private readonly projectChange$ = new Subject<Project | null>();

  private readonly app: Application = new Application();
  private appInitialized = false;
  private fpsInterval: ReturnType<typeof setInterval> | null = null;
  private _pointerInsideCanvas = false;

  constructor() {
    this.projectChange$.pipe(takeUntil(this.destroy$)).subscribe((project) => {
      if (!project) {
        return;
      }

      project.resizeViewport(this.app.renderer.width, this.app.renderer.height);

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

      project.cursorPosition$
        .pipe(
          takeUntil(merge(this.destroy$, this.projectChange$)),
          filter(() => this._pointerInsideCanvas),
          throttleTime(33.33)
        )
        .subscribe((pos) => {
          this.cursorPositionChange.emit(pos);
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

    this.canvas.nativeElement.addEventListener('pointerenter', () => {
      this._pointerInsideCanvas = true;
    });
    this.canvas.nativeElement.addEventListener('pointerleave', () => {
      this._pointerInsideCanvas = false;
    });

    await this.app.init({
      canvas: this.canvas.nativeElement,
      resizeTo: this.hostEl.nativeElement,
      preference: 'webgpu',
      antialias: true,
      hello: false,
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

    this.appInitialized = true;
    this.loaded.set(true);

    if (this.fps) {
      this.fpsInterval = setInterval(() => {
        this.fps!.set(Math.round(this.app.ticker.FPS));
      }, 500);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    if (this.fpsInterval !== null) {
      clearInterval(this.fpsInterval);
    }
    if (this.appInitialized) {
      this.app.destroy();
    }
  }
}
