import { inject, Injectable } from '@angular/core';
import { autoDetectRenderer, Container, Matrix, Renderer } from 'pixi.js';
import { Project } from '../../project/project';
import { ThemingService } from '../../theming/theming.service';

/**
 * One acquired use of the shared watch renderer. `release()` is idempotent;
 * the renderer is destroyed when the last lease releases.
 */
export interface WatchRendererLease {
  /** Blits the project onto the canvas at its current viewport transform. */
  render(project: Project, canvas: HTMLCanvasElement): void;
  release(): void;
}

/**
 * The single renderer shared by every open watch canvas — the page runs at
 * most two rendering contexts (board + watches) no matter how many watches
 * are open. Created lazily on the first lease with the same backend ladder as
 * the board (`webgpu` → `webgl` → `canvas`); WebGPU and Canvas drive multiple
 * target canvases natively, the WebGL branch needs `multiView` (an off-DOM
 * master canvas blitted to each target). Destroyed when the last lease
 * releases — watches close on simulation exit, so the renderer never outlives
 * a session by more than the teardown.
 */
@Injectable({ providedIn: 'root' })
export class WatchRendererService {
  private readonly theming = inject(ThemingService);

  private _renderer: Renderer | null = null;
  private _creating: Promise<Renderer> | null = null;
  private _leases = 0;

  /** Acquires the shared renderer, creating it on first use. */
  public async acquire(): Promise<WatchRendererLease> {
    this._leases++;
    try {
      await this._ensureRenderer();
    } catch (err) {
      this._leases--;
      throw err;
    }
    let released = false;
    return {
      render: (project, canvas) => this._render(project, canvas),
      release: () => {
        if (released) {
          return;
        }
        released = true;
        this._release();
      }
    };
  }

  private async _ensureRenderer(): Promise<void> {
    if (this._renderer) {
      return;
    }
    this._creating ??= autoDetectRenderer({
      preference: 'webgpu',
      webgl: { multiView: true },
      width: 64,
      height: 64,
      antialias: true,
      hello: false
    });
    const renderer = await this._creating;
    this._creating = null;
    if (this._leases === 0) {
      // Every lease was released while the renderer was still booting.
      renderer.destroy();
      return;
    }
    this._renderer = renderer;
  }

  private _release(): void {
    this._leases--;
    if (this._leases === 0 && this._renderer) {
      this._renderer.destroy();
      this._renderer = null;
    }
  }

  private _render(project: Project, canvas: HTMLCanvasElement): void {
    if (!this._renderer || project.destroyed) {
      return;
    }
    // No CullerPlugin runs on manual renders — force the subtree visible so
    // stale `culled` bits can't hide content.
    this._uncull(project);
    // The canvas backing store is DPR-scaled by its owner; the project's
    // viewport transform is CSS-pixel based, so scale it up to match.
    const resolution =
      canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
    project.updateLocalTransform();
    this._renderer.render({
      container: project,
      target: canvas,
      clearColor: this.theming.currentTheme().background,
      transform: new Matrix()
        .scale(resolution, resolution)
        .append(project.localTransform)
    });
  }

  private _uncull(container: Container): void {
    container.culled = false;
    for (const child of container.children) {
      this._uncull(child as Container);
    }
  }
}
