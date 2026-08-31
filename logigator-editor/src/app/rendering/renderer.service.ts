import { computed, inject, Injectable, signal } from '@angular/core';
import {
  autoDetectRenderer,
  Container,
  getCanvasTexture,
  Renderer
} from 'pixi.js';
import { ThemingService } from '../theming/theming.service';

/**
 * One acquired use of the shared renderer. `release()` is idempotent; the
 * renderer is destroyed when the last lease releases.
 */
export interface RendererLease {
  /**
   * Blits a scene root onto a canvas at its current transform, sized to the
   * canvas's CSS box at the device pixel ratio. Clears to the theme background.
   */
  render(container: Container, canvas: HTMLCanvasElement): void;
  release(): void;
}

/**
 * Marks a whole subtree un-culled. Manual renders never run a cull pass, so a
 * subtree culled against a different viewport must be forced visible first;
 * the next culled render re-culls against its own view.
 */
export function uncullTree(container: Container): void {
  container.culled = false;
  for (const child of container.children) {
    uncullTree(child as Container);
  }
}

/**
 * Owns the single PixiJS renderer shared by every canvas and every offscreen
 * consumer, so the page runs one rendering context however many canvases are
 * live. Created lazily on the first lease with a `webgl` → `canvas` ladder;
 * WebGL needs `multiView` (an off-DOM master canvas blitted to each target).
 * Destroyed when the last lease releases.
 *
 * Offscreen consumers don't lease: they read {@link renderer} directly and
 * gate on {@link available}.
 */
@Injectable({ providedIn: 'root' })
export class RendererService {
  private readonly theming = inject(ThemingService);

  private readonly _renderer = signal<Renderer | null>(null);
  private _creating: Promise<Renderer> | null = null;
  private _leases = 0;

  /** Whether a leased renderer is live; overlays gate their render on this. */
  public readonly available = computed(() => this._renderer() !== null);

  /** The live renderer for offscreen (render-to-texture) use, if any. */
  public get renderer(): Renderer | null {
    return this._renderer();
  }

  /** Acquires the shared renderer, creating it on first use. */
  public async acquire(): Promise<RendererLease> {
    this._leases++;
    try {
      await this._ensureRenderer();
    } catch (err) {
      this._leases--;
      throw err;
    }
    let released = false;
    return {
      render: (container, canvas) => this._render(container, canvas),
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
    if (this._renderer()) {
      return;
    }
    this._creating ??= autoDetectRenderer({
      // WebGPU is disabled: pixi 8.19's backend needs patches to work here at
      // all, and even patched it loses the GPU device on AMD/D3D12. See
      // docs/webgpu.md.
      preference: 'webgl',
      webgl: { multiView: true },
      width: 64,
      height: 64,
      antialias: true,
      powerPreference: 'high-performance',
      hello: false,
      // No scene node is interactive: input comes from PointerController.
      eventFeatures: {
        move: false,
        click: false,
        wheel: false,
        globalMove: false
      }
    });
    const renderer = await this._creating;
    this._creating = null;
    if (this._leases === 0) {
      // Every lease was released while the renderer was still booting.
      renderer.destroy();
      return;
    }
    this._renderer.set(renderer);
  }

  private _release(): void {
    this._leases--;
    const renderer = this._renderer();
    if (this._leases === 0 && renderer) {
      renderer.destroy();
      this._renderer.set(null);
    }
  }

  private _render(container: Container, canvas: HTMLCanvasElement): void {
    const renderer = this._renderer();
    if (!renderer || container.destroyed) {
      return;
    }
    // pixi caches one CanvasSource per target canvas and writes its size back
    // onto the element every render, so the backing store must be sized
    // through the source (CSS size at the DPR resolution) and never via
    // canvas.width. The root projection divides by the source resolution, so
    // render space stays CSS pixels and the DPR only sharpens the backing
    // store. A no-op when nothing changed.
    getCanvasTexture(canvas).source.resize(
      Math.max(1, Math.round(canvas.clientWidth || 1)),
      Math.max(1, Math.round(canvas.clientHeight || 1)),
      window.devicePixelRatio || 1
    );
    renderer.render({
      container,
      target: canvas,
      clearColor: this.theming.currentTheme().background
    });
  }
}
