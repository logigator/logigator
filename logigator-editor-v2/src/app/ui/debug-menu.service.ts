/* eslint-disable no-console -- this menu's purpose is raw console output */
import { inject, Injectable } from '@angular/core';
import { type MenuItem } from '@logigator/ui';
import { RendererType, type Renderer, type WebGLRenderer } from 'pixi.js';
import { environment } from '../../environments/environment';
import { ProjectService } from '../project/project.service';
import { BoardCompilerService } from '../simulation/compiler/board-compiler.service';
import { RendererHandleService } from '../rendering/renderer-handle.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ToastService } from '../logging/toast.service';
import { pickTextFile } from '../utils/file-picker';
import {
  runWatchRendererSpike,
  SpikePreference
} from '../inspection/watch/watch-renderer-spike';
import { insertWatchDemoCircuit } from '../inspection/watch/watch-demo-circuit';

/**
 * Builds the title-bar "Debug" menu and owns its commands. Gated by
 * `environment.debug.debugMenu` — {@link buildMenuItem} returns `null` when disabled,
 * so the menu is absent in production. Output goes to the console (and a toast
 * where a console object is not enough); these are developer tools and are
 * intentionally untranslated.
 */
@Injectable({ providedIn: 'root' })
export class DebugMenuService {
  private readonly projectService = inject(ProjectService);
  private readonly boardCompiler = inject(BoardCompilerService);
  private readonly rendererHandle = inject(RendererHandleService);
  private readonly persistence = inject(PersistenceService);
  private readonly toast = inject(ToastService);

  public readonly enabled = environment.debug.debugMenu;

  /** The top-level "Debug" menubar item, or `null` when the menu is disabled. */
  public buildMenuItem(): MenuItem | null {
    if (!this.enabled) return null;
    return {
      label: 'Debug',
      items: [
        {
          label: 'Print compiled board',
          command: () => this.printCompiledBoard()
        },
        {
          label: 'Print renderer mode',
          command: () => this.printRendererMode()
        },
        { label: 'Spawn test toasts', command: () => this.spawnTestToasts() },
        { separator: true },
        {
          label: 'Watch renderer spike',
          command: () => this.watchRendererSpike()
        },
        {
          label: 'Watch renderer spike (canvas)',
          command: () => this.watchRendererSpike('canvas')
        },
        {
          label: 'Insert watch demo circuit',
          command: () => this.insertWatchDemo()
        },
        { separator: true },
        { label: 'Generate dump', command: () => this.generateDump() },
        { label: 'Import dump', command: () => this.importDump() }
      ]
    };
  }

  private insertWatchDemo(): void {
    const project = this.projectService.activeProject();
    if (!project) {
      this.toast.warn('No active project.');
      return;
    }
    insertWatchDemoCircuit(project);
    this.toast.info('Watch demo circuit inserted (Nest at 10,10).');
  }

  private watchRendererSpike(preference?: SpikePreference): void {
    runWatchRendererSpike(preference)
      .then((mode) => this.toast.info(`Watch renderer spike: ${mode}`))
      .catch((err: unknown) => {
        console.error('[debug] watch renderer spike failed', err);
        this.toast.error('Watch renderer spike failed — see console.');
      });
  }

  private printCompiledBoard(): void {
    const project = this.projectService.activeProject();
    if (!project) {
      this.toast.warn('No active project to compile.');
      return;
    }
    try {
      const compiled = this.boardCompiler.compile(project);
      console.log('[debug] compiled board', compiled);
    } catch (err) {
      console.error('[debug] failed to compile board', err);
      this.toast.error('Failed to compile board — see console.');
    }
  }

  private printRendererMode(): void {
    const renderer = this.rendererHandle.renderer;
    if (!renderer) {
      this.toast.warn('Renderer is not ready yet.');
      return;
    }
    const mode = this.rendererMode(renderer);
    console.log('[debug] renderer mode:', mode, renderer);
    this.toast.info(`Renderer: ${mode}`);
  }

  /** Fires one toast of every severity to eyeball the stack and its styling. */
  private spawnTestToasts(): void {
    this.toast.success('A success toast.');
    this.toast.info('An info toast.');
    this.toast.warn('A warning toast.');
    this.toast.error('An error toast.');
  }

  private generateDump(): void {
    const project = this.projectService.activeProject();
    if (!project) {
      this.toast.warn('No active project to dump.');
      return;
    }
    this.persistence.exportProjectDumpToFile(project);
  }

  private importDump(): void {
    void pickTextFile('.json,application/json').then((content) => {
      if (content === null) return;
      this.persistence
        .importProjectDump(content)
        .then(() => this.toast.success('Project dump imported.'))
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[debug] failed to import dump', err);
          this.toast.error(`Failed to import dump: ${message}`);
        });
    });
  }

  /** Resolves which backend the live renderer is running on. */
  private rendererMode(renderer: Renderer): string {
    switch (renderer.type) {
      case RendererType.WEBGPU:
        return 'WebGPU';
      case RendererType.WEBGL: {
        const version = (renderer as WebGLRenderer).context?.webGLVersion;
        return version ? `WebGL ${version}` : 'WebGL';
      }
      case RendererType.CANVAS:
        return 'Canvas';
      default:
        return renderer.name || `Unknown (type ${renderer.type})`;
    }
  }
}
