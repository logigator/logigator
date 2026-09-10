/* eslint-disable no-console -- this menu's purpose is raw console output */
import { inject, Injectable } from '@angular/core';
import { type MenuItem } from '@logigator/ui';
import { RendererType, type Renderer, type WebGLRenderer } from 'pixi.js';
import { ProjectService } from '../project/project.service';
import { BoardCompilerService } from '../simulation/compiler/board-compiler.service';
import { SimulationService } from '../simulation/simulation.service';
import { RendererService } from '../rendering/renderer.service';
import { QuadTreeContainer } from '../rendering/quad-tree-container';
import { GridElement } from '../rendering/grid-element';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectDumpService } from '../persistence/dump/project-dump.service';
import { ToastService } from '../logging/toast.service';
import { ClientInfoService } from '../bug-report/client-info.service';
import { pickTextFile } from '../utils/file-picker';

/**
 * Builds the title-bar "Debug" menu and owns its commands. Output goes to the
 * console, and to a toast where a console object is not enough; developer
 * tools, so intentionally untranslated.
 *
 * The gate is `DebugMenuToggleService.enabled()` at the menu-building sites,
 * not a check in here: this module ships in every build so
 * `window.__logigatorDebug()` can reach it in production, and resolving the
 * service behind that guard is what keeps the services these commands inject
 * unconstructed until the menu is switched on.
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
        {
          label: 'Print quad-tree stats',
          command: () => this.printQuadTreeStats()
        },
        {
          label: 'Print quad-tree structure',
          command: () => this.printQuadTreeStructure()
        },
        {
          label: 'Check quad-tree integrity',
          command: () => this.checkQuadTrees()
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

  /** Exercises the global error handler and the bug-report dialog it opens. */
  private throwTestError(): void {
    throw new Error('Test error thrown from the debug menu.');
  }

  /**
   * Full vs delta snapshot counts and the average visible link flips per
   * snapshot. A high full-snapshot share means the engine keeps exceeding its
   * delta threshold, i.e. a very busy board.
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

  /**
   * Shape and occupancy of the active project's two spatial indexes, with the
   * distributions charted because a bar reads better than an array of counts.
   */
  private printQuadTreeStats(): void {
    this.forEachQuadTree((label, tree) => {
      const stats = tree.stats();
      console.log(`[debug] ${label} quad tree`, stats);
      console.log(tree.formatDistributions(stats));
    });
  }

  /** Prints both spatial indexes' entry hierarchies as text trees. */
  private printQuadTreeStructure(): void {
    this.forEachQuadTree((label, tree) => {
      console.log(`[debug] ${label} quad tree\n${tree.formatTree()}`);
    });
  }

  /**
   * Runs the quad trees' invariant check — the cheapest way to tell a
   * structural bug (a stale item map, an element that moved without being
   * re-inserted) from a rendering or interaction one.
   */
  private checkQuadTrees(): void {
    let total = 0;
    this.forEachQuadTree((label, tree) => {
      const problems = tree.validate();
      total += problems.length;
      if (problems.length === 0) {
        console.log(`[debug] ${label} quad tree: no problems`);
        return;
      }
      console.error(
        `[debug] ${label} quad tree: ${problems.length} problem(s)`,
        problems
      );
    });
    if (total > 0) {
      this.toast.error(
        `Quad trees report ${total} problem(s) — see console.`,
        'DebugMenuService'
      );
    } else {
      this.toast.success('Quad trees are consistent.', 'DebugMenuService');
    }
  }

  private forEachQuadTree(
    report: (label: string, tree: QuadTreeContainer<GridElement>) => void
  ): void {
    const project = this.projectService.activeProject();
    if (!project) {
      this.toast.warn('No active project to inspect.', 'DebugMenuService');
      return;
    }
    report('component', project.quadTrees.components);
    report('wire', project.quadTrees.wires);
  }

  /** One toast of every severity, to eyeball the stack and its styling. */
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

  /** Which backend the live renderer is running on. */
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
