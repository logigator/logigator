/* eslint-disable no-console -- this menu's purpose is raw console output */
import { inject, Injectable } from '@angular/core';
import { type MenuItem } from '@logigator/ui';
import { RendererType, type Renderer, type WebGLRenderer } from 'pixi.js';
import { ProjectService } from '../project/project.service';
import { BoardCompilerService } from '../simulation/compiler/board-compiler.service';
import { SimulationService } from '../simulation/simulation.service';
import { RendererService } from '../rendering/renderer.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectDumpService } from '../persistence/dump/project-dump.service';
import { ToastService } from '../logging/toast.service';
import { ClientInfoService } from '../bug-report/client-info.service';
import { pickTextFile } from '../utils/file-picker';

/**
 * Builds the title-bar "Debug" menu and owns its commands. Output goes to the
 * console (and a toast where a console object is not enough); these are
 * developer tools and are intentionally untranslated.
 *
 * The gate is the `DEBUG_MENU` define at the call sites in `EditorMenuService`,
 * not a check in here: that is what keeps this module — and the commands it
 * reaches — out of a production bundle rather than merely inert inside it.
 */
@Injectable({ providedIn: 'root' })
export class DebugMenuService {
  private readonly projectService = inject(ProjectService);
  private readonly boardCompiler = inject(BoardCompilerService);
  private readonly simulation = inject(SimulationService);
  private readonly rendererService = inject(RendererService);
  private readonly persistence = inject(PersistenceService);
  private readonly projectDump = inject(ProjectDumpService);
  private readonly toast = inject(ToastService);
  private readonly clientInfo = inject(ClientInfoService);

  /** The top-level "Debug" menubar item. */
  public buildMenuItem(): MenuItem {
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
        {
          label: 'Print client info',
          command: () => this.printClientInfo()
        },
        {
          label: 'Print simulation snapshot stats',
          command: () => this.printSnapshotStats()
        },
        { label: 'Spawn test toasts', command: () => this.spawnTestToasts() },
        { label: 'Throw test error', command: () => this.throwTestError() },
        { separator: true },
        { label: 'Download project JSON', command: () => this.downloadJson() },
        { label: 'Generate dump', command: () => this.generateDump() },
        { label: 'Import dump', command: () => this.importDump() }
      ]
    };
  }

  private printCompiledBoard(): void {
    const project = this.projectService.activeProject();
    if (!project) {
      this.toast.warn('No active project to compile.', 'DebugMenuService');
      return;
    }
    try {
      const compiled = this.boardCompiler.compile(project);
      console.log('[debug] compiled board', compiled);
    } catch (err) {
      console.error('[debug] failed to compile board', err);
      this.toast.error(
        'Failed to compile board — see console.',
        'DebugMenuService'
      );
    }
  }

  private printRendererMode(): void {
    const renderer = this.rendererService.renderer;
    if (!renderer) {
      this.toast.warn('Renderer is not ready yet.', 'DebugMenuService');
      return;
    }
    const mode = this.rendererMode(renderer);
    console.log('[debug] renderer mode:', mode, renderer);
    this.toast.info(`Renderer: ${mode}`, 'DebugMenuService');
  }

  /** Logs the client environment exactly as a bug report would attach it. */
  private printClientInfo(): void {
    const info = this.clientInfo.collect();
    console.log('[debug] client info', info);
    this.toast.info('Client info printed to console.', 'DebugMenuService');
  }

  /**
   * Throws an uncaught error to exercise the global error handler and the
   * bug-report dialog it opens.
   */
  private throwTestError(): void {
    throw new Error('Test error thrown from the debug menu.');
  }

  /**
   * Dumps the running session's snapshot tallies: full vs delta snapshot
   * counts and the average number of visible link flips per snapshot (how
   * active the board is). A high full-snapshot share means the engine keeps
   * exceeding its delta threshold — a very busy board.
   */
  private printSnapshotStats(): void {
    const stats = this.simulation.snapshotStats;
    if (!stats) {
      this.toast.warn('No active simulation session.', 'DebugMenuService');
      return;
    }
    const fullPercent =
      stats.total > 0 ? Math.round((stats.full / stats.total) * 100) : 0;
    console.log('[debug] simulation snapshots', {
      full: stats.full,
      delta: stats.delta,
      total: stats.total,
      fullPercent,
      switchedLinks: stats.switchedLinks,
      totalLinks: stats.totalLinks,
      avgSwitchedPerFrame: +stats.avgSwitchedPerFrame.toFixed(1),
      avgSwitchedPercent: +stats.avgSwitchedPercent.toFixed(2)
    });
    this.toast.info(
      `Snapshots: ${stats.full} full (${fullPercent}%) / ${stats.delta} delta · ` +
        `~${stats.avgSwitchedPerFrame.toFixed(1)} links/frame ` +
        `(${stats.avgSwitchedPercent.toFixed(2)}% of ${stats.totalLinks})`,
      'DebugMenuService'
    );
  }

  /** Fires one toast of every severity to eyeball the stack and its styling. */
  private spawnTestToasts(): void {
    this.toast.success('A success toast.', 'DebugMenuService');
    this.toast.info('An info toast.', 'DebugMenuService');
    this.toast.warn('A warning toast.', 'DebugMenuService');
    this.toast.error('An error toast.', 'DebugMenuService');
  }

  private downloadJson(): void {
    const project = this.projectService.activeProject();
    if (!project) {
      this.toast.warn('No active project to download.', 'DebugMenuService');
      return;
    }
    this.persistence.exportProjectToJsonFile(project);
  }

  private generateDump(): void {
    const project = this.projectService.activeProject();
    if (!project) {
      this.toast.warn('No active project to dump.', 'DebugMenuService');
      return;
    }
    this.projectDump.exportDumpToFile(project);
  }

  private importDump(): void {
    void pickTextFile('.json,application/json').then((content) => {
      if (content === null) return;
      this.projectDump
        .importDump(content)
        .then(() =>
          this.toast.success('Project dump imported.', 'DebugMenuService')
        )
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[debug] failed to import dump', err);
          this.toast.error(
            `Failed to import dump: ${message}`,
            'DebugMenuService'
          );
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
