import { inject, Injectable, signal } from '@angular/core';
import {
  BitmapText,
  Container,
  Graphics,
  Matrix,
  Rectangle,
  RenderTexture,
  Text,
  type ColorSource
} from 'pixi.js';
import { RendererService, uncullTree } from './renderer.service';
import { GraphicsProviderService } from './graphics-provider.service';
import { GridGraphics } from './graphics/grid.graphics';
import { ThemingService } from '../theming/theming.service';
import { ThemeType } from '../theming/theme-type.enum';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
import { ZOOM_STEP_BASE, ZOOM_STEP_MIN } from '../project/viewport-controller';
import { nextAnimationFrame } from '../utils/scheduling';
import { environment } from '../../environments/environment';

export type SnapshotBackground = 'grid' | 'solid' | 'transparent';

export interface SnapshotOptions {
  /** Output pixels per grid unit = `gridSize × multiplier`. */
  multiplier: number;
  /** `grid` = theme color + dot-grid, `solid` = theme color, `transparent`. */
  background: SnapshotBackground;
  /** Margin around content, in grid units. Defaults to {@link EXPORT_MARGIN_GRID}. */
  marginGrid?: number;
  /**
   * Hides every text node (`Text` and `BitmapText`) during the content pass
   * instead of re-tuning glyph resolution. For tiny outputs (minimap) where
   * glyphs are sub-pixel smears — shapes carry the layout, text is noise.
   */
  hideText?: boolean;
}

/** Margin kept around the content bounds in a full-project snapshot. */
export const EXPORT_MARGIN_GRID = 1;
/** Fallback content box (grid units) used when the project is empty. */
export const EMPTY_FALLBACK_GRID = 16;
/** Default edge length (px) of a server-save preview. */
export const PREVIEW_SIZE = 1024;
/**
 * Previews rendered below this multiplier hide text outright (the minimap's
 * rationale): glyphs are sub-pixel smears that add scene nodes to both theme
 * passes without adding legibility.
 */
const PREVIEW_HIDE_TEXT_BELOW = 0.5;
/** Grid units per export-grid chunk; matches the live {@link Grid}. */
const GRID_CHUNK = 32;
/**
 * The zoom-ladder step the content renders at for multipliers ≥ 1: the "100%
 * zoom" look. Decoupling the render from the live zoom keeps snapshots
 * deterministic, and rendering at scale 1 lets the output matrix scale line
 * weights and grid dots up proportionally with the multiplier instead of
 * holding them screen-constant.
 */
const REFERENCE_STEP = 0;

/**
 * Renders a project's content into an offscreen `RenderTexture`. The reusable
 * primitive behind image export, server previews and the minimap: it
 * renders the *real* scene graph, so every component type — including ROM and
 * flattened custom components — is covered without any per-type code.
 *
 * Callers own the returned texture and must destroy it (`texture.destroy(true)`).
 */
@Injectable({
  providedIn: 'root'
})
export class BoardSnapshotService {
  private readonly rendererService = inject(RendererService);
  private readonly graphicsProvider = inject(GraphicsProviderService);
  private readonly themingService = inject(ThemingService);
  private readonly logging = inject(LoggingService);

  /** Whether a renderer is live (false before the board has loaded). */
  public get available(): boolean {
    return this.rendererService.available();
  }

  /**
   * The region (grid units) a full-project snapshot covers: tight content
   * bounds plus a margin, or a small fixed box when the project is empty.
   */
  public computeRegion(
    project: Project,
    marginGrid: number = EXPORT_MARGIN_GRID
  ): Rectangle {
    const content =
      project.getContentBounds() ??
      new Rectangle(0, 0, EMPTY_FALLBACK_GRID, EMPTY_FALLBACK_GRID);
    return new Rectangle(
      content.x - marginGrid,
      content.y - marginGrid,
      content.width + 2 * marginGrid,
      content.height + 2 * marginGrid
    );
  }

  /** Output pixel dimensions for a region at a multiplier. */
  public outputSize(
    region: Rectangle,
    multiplier: number
  ): { width: number; height: number } {
    const pxPerUnit = environment.gridSize * multiplier;
    return {
      width: Math.max(1, Math.round(region.width * pxPerUnit)),
      height: Math.max(1, Math.round(region.height * pxPerUnit))
    };
  }

  /**
   * Renders a project's content (tight bounds + margin, or empty fallback) into
   * a texture. Caller owns the returned texture.
   */
  public renderProjectToTexture(
    project: Project,
    options: SnapshotOptions
  ): RenderTexture {
    const region = this.computeRegion(project, options.marginGrid);
    return this.renderRegionToTexture(project, region, options);
  }

  /**
   * Renders a project's content into an `HTMLCanvasElement` (extracted from the
   * texture). The texture is destroyed before returning; the canvas is a
   * standalone copy.
   */
  public renderProjectToCanvas(
    project: Project,
    options: SnapshotOptions
  ): HTMLCanvasElement {
    const region = this.computeRegion(project, options.marginGrid);
    return this.renderRegionToCanvas(project, region, options);
  }

  /**
   * `true` while a preview generation holds the scene in a transient state
   * (mid-pass baked colors, pending textures). Other snapshot consumers (the
   * minimap) must not render the project while this is set — they would
   * capture the wrong theme — and should retry once it clears.
   */
  public readonly generatingPreviews = signal(false);

  /** Serializes preview generations — the theme passes mutate global scene state. */
  private _previewChain: Promise<unknown> = Promise.resolve();

  /**
   * Renders dark- and light-themed PNG previews of the project for server-side
   * thumbnails: a square `sizePx × sizePx` image with a **transparent**
   * background and the content centered. Resolves `null` when no renderer is
   * available (or the project is destroyed mid-flight) so the save flow can
   * skip the upload silently.
   *
   * Theme colors are baked into cached graphics, so the non-live theme is
   * produced by briefly switching the global theme and redrawing the project —
   * the same path a live theme toggle uses. To soften the main-thread spike on
   * large boards the work is spread over animation frames: the non-live theme
   * bakes and renders on one frame, the live theme (whose redraw doubles as
   * the scene restore) on the next, and the GPU readbacks on a third, after
   * the queued render work has had a frame to drain.
   *
   * The theme *signal* is only ever switched and restored within a single
   * synchronous block — effects flush between frames and must never observe
   * the temporary theme. The scene's *baked colors* do stay wrong-themed
   * across the first frame boundary; on-screen paints are suspended for that
   * window (missed frames replay on resume) and snapshot consumers hold off
   * via {@link generatingPreviews}.
   */
  public generatePreviews(
    project: Project,
    sizePx: number = PREVIEW_SIZE
  ): Promise<{ dark: Blob; light: Blob } | null> {
    const run = this._previewChain.then(() =>
      this._generatePreviews(project, sizePx)
    );
    this._previewChain = run.catch(() => undefined);
    return run;
  }

  private async _generatePreviews(
    project: Project,
    sizePx: number
  ): Promise<{ dark: Blob; light: Blob } | null> {
    if (!this.available || project.destroyed) return null;

    const region = this._squareRegion(this.computeRegion(project));
    const multiplier = sizePx / (region.width * environment.gridSize);
    const options: SnapshotOptions = {
      multiplier,
      background: 'transparent',
      hideText: multiplier < PREVIEW_HIDE_TEXT_BELOW
    };

    this.generatingPreviews.set(true);
    let textures: { dark: RenderTexture; light: RenderTexture } | null = null;
    try {
      textures = await this._renderPreviewTextures(project, region, options);
      if (!textures) return null;

      // Both renders are queued on the GPU; reading back immediately would
      // block on that whole pipeline. Give it a frame to drain so the
      // readbacks below pay only their own transfer cost.
      await nextAnimationFrame();
      const renderer = this.rendererService.renderer;
      if (!renderer) return null;

      const darkCanvas = renderer.extract.canvas({
        target: textures.dark
      }) as HTMLCanvasElement;
      const lightCanvas = renderer.extract.canvas({
        target: textures.light
      }) as HTMLCanvasElement;
      const [dark, light] = await Promise.all([
        this._canvasToBlob(darkCanvas),
        this._canvasToBlob(lightCanvas)
      ]);
      return dark && light ? { dark, light } : null;
    } finally {
      this.generatingPreviews.set(false);
      textures?.dark.destroy(true);
      textures?.light.destroy(true);
    }
  }

  /**
   * The scene-mutating half of a preview generation: bakes and renders the
   * non-live theme, then — one animation frame later — the live theme, whose
   * redraw is also the scene restore. On-screen paints are suspended for the
   * whole window. Returns both textures (owned by the caller), or `null` when
   * the project or renderer dies between the frames; on any exit path other
   * than success the scene is rebaked in the live theme before paints resume.
   */
  private async _renderPreviewTextures(
    project: Project,
    region: Rectangle,
    options: SnapshotOptions
  ): Promise<{ dark: RenderTexture; light: RenderTexture } | null> {
    const original = this.themingService.currentThemeType();
    const other =
      original === ThemeType.DARK ? ThemeType.LIGHT : ThemeType.DARK;

    const resume = this.rendererService.suspendPaints();
    let otherTexture: RenderTexture | null = null;
    let liveTexture: RenderTexture | null = null;
    // Whether the scene's baked colors match the live theme, so the error
    // path knows to rebake before paints resume.
    let sceneLive = true;
    try {
      try {
        // The signal switch is confined to this synchronous block: effects
        // flush between frames and must never observe the temporary theme.
        // Only the scene's baked colors carry across the frame boundary,
        // which the paint suspension covers.
        sceneLive = false;
        this.themingService.setActiveThemeType(other);
        project.applyTheme(false);
        otherTexture = this.renderRegionToTexture(project, region, options);
      } finally {
        this.themingService.setActiveThemeType(original);
      }

      // Splitting the second pass onto its own frame halves the per-frame
      // main-thread cost: two rebuild+render frames instead of one double one.
      await nextAnimationFrame();
      if (project.destroyed || !this.available) {
        otherTexture.destroy(true);
        return null;
      }

      project.applyTheme(false);
      sceneLive = true;
      liveTexture = this.renderRegionToTexture(project, region, options);
      // renderRegionToTexture leaves the scene un-culled; re-cull so a board
      // frame replayed on resume renders the normal culled set.
      project.cull();

      return original === ThemeType.DARK
        ? { dark: liveTexture, light: otherTexture }
        : { dark: otherTexture, light: liveTexture };
    } catch (err) {
      otherTexture?.destroy(true);
      liveTexture?.destroy(true);
      throw err;
    } finally {
      if (!sceneLive && !project.destroyed) {
        try {
          project.applyTheme(false);
        } catch {
          // The redraw already threw once; don't let the retry mask the
          // original error.
          this.logging.warn(
            'Failed to restore the live theme after a preview pass error',
            'BoardSnapshotService'
          );
        }
      }
      resume();
    }
  }

  /** Expands a region to a square centered on it (pads the shorter axis). */
  private _squareRegion(region: Rectangle): Rectangle {
    const side = Math.max(region.width, region.height);
    return new Rectangle(
      region.x - (side - region.width) / 2,
      region.y - (side - region.height) / 2,
      side,
      side
    );
  }

  private _canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    );
  }

  /** Renders a region into an `HTMLCanvasElement`. See {@link renderProjectToCanvas}. */
  public renderRegionToCanvas(
    project: Project,
    region: Rectangle,
    options: SnapshotOptions
  ): HTMLCanvasElement {
    const renderer = this.rendererService.renderer;
    if (!renderer) {
      this.logging.error(
        'renderRegionToCanvas called with no renderer available',
        'BoardSnapshotService'
      );
      throw new Error('BoardSnapshotService: no renderer available');
    }
    const texture = this.renderRegionToTexture(project, region, options);
    try {
      return renderer.extract.canvas({
        target: texture
      }) as HTMLCanvasElement;
    } finally {
      texture.destroy(true);
    }
  }

  /**
   * Renders an arbitrary region (grid units) of a project into a texture. A
   * passed transform replaces the rendered container's own transform (see
   * PixiJS `renderer.render`), so the matrices below bake in the `gridSize`
   * scale that `gridSpace` would otherwise apply.
   */
  public renderRegionToTexture(
    project: Project,
    region: Rectangle,
    options: SnapshotOptions
  ): RenderTexture {
    const renderer = this.rendererService.renderer;
    if (!renderer) {
      this.logging.error(
        'renderRegionToTexture called with no renderer available',
        'BoardSnapshotService'
      );
      throw new Error('BoardSnapshotService: no renderer available');
    }

    const gridSize = environment.gridSize;
    const pxPerUnit = gridSize * options.multiplier;
    const { width, height } = this.outputSize(region, options.multiplier);

    // Scale that drives line weights / grid-dot sizes. Capped at the 100%
    // reference so weights grow proportionally for multipliers ≥ 1, but for
    // multipliers < 1 (capped huge boards, previews, minimap) it tracks the
    // multiplier so strokes and dots never render thinner than they do at
    // 100% zoom — otherwise they go sub-pixel and the thumbnail washes out.
    const lineScale = this._quantizeLineScale(options.multiplier);

    const texture = RenderTexture.create({
      width,
      height,
      resolution: 1,
      antialias: true
    });

    // Shared translation (output px): the region's top-left maps to (0,0).
    const tx = -region.x * pxPerUnit;
    const ty = -region.y * pxPerUnit;

    const transparent = options.background === 'transparent';
    const clearColor: ColorSource = transparent
      ? [0, 0, 0, 0]
      : this.themingService.currentTheme().background;
    const withGrid = options.background === 'grid';

    let grid: Container | null = null;
    if (withGrid) {
      // Dots authored at `lineScale` (project-pixel space); the matrix scales
      // them by the multiplier. Spacing always grows with the multiplier; dot
      // size grows for multipliers ≥ 1 and is floored at ~1px below that.
      grid = this._buildGrid(region, lineScale);
      const gridMatrix = new Matrix()
        .scale(options.multiplier, options.multiplier)
        .translate(tx, ty);
      renderer.render({
        container: grid,
        transform: gridMatrix,
        target: texture,
        clearColor,
        clear: true
      });
    }

    // Content pass. gridSpace children sit in grid units, so scale by
    // gridSize × multiplier.
    const contentMatrix = new Matrix()
      .scale(pxPerUnit, pxPerUnit)
      .translate(tx, ty);

    // The board's cull pass only runs on the on-screen ticker render, never on
    // a manual render-to-texture, so off-screen quad-tree entries keep last
    // frame's `culled` bit and would be missing here. Force the content subtree
    // visible; the next on-screen frame re-culls against the live viewport.
    uncullTree(project.gridSpace);
    project.setOverlayVisible(false);

    // Render the content at `lineScale`, independent of the live zoom, so the
    // export keeps the natural look: the matrix scales line weights up
    // proportionally with the multiplier, and the `lineScale` floor keeps them
    // visible below 1×. Text is pre-rasterized, so its glyph resolution is
    // bumped to the multiplier separately to stay crisp — or hidden (`hideText`)
    // for outputs too small to render glyphs. Everything is restored afterwards;
    // nothing renders on-screen between the calls.
    const liveScale = project.scale.x;
    this._applyContentScale(project, lineScale);
    const restoreText = options.hideText
      ? this._hideTextNodes(project.gridSpace)
      : this._tuneTextResolution(project.gridSpace, options.multiplier);
    // Selection is a tint highlight on the real scene objects; without this a
    // snapshot taken while a selection is live (e.g. the minimap re-rendering
    // after a drag-move, which commits an action yet leaves the moved elements
    // selected) bakes the highlight into committed content.
    const restoreTint = project.selectionManager.suppressTintForRender();
    try {
      renderer.render({
        container: project.gridSpace,
        transform: contentMatrix,
        target: texture,
        clearColor,
        // When a grid pass already cleared, draw the content over it.
        clear: !withGrid
      });
    } finally {
      restoreTint();
      this._applyContentScale(project, liveScale);
      restoreText();
      project.setOverlayVisible(true);
      grid?.destroy({ children: true });
    }

    return texture;
  }

  /**
   * Snaps a snapshot multiplier onto the live zoom ladder
   * (`ZOOM_STEP_BASE^step`, step ∈ [{@link ZOOM_STEP_MIN}, 0]). Line weights
   * only ever get re-tuned to scales the live zoom also produces, so the
   * scale-keyed GraphicsContext cache is reused instead of growing a permanent
   * entry per arbitrary multiplier (previews and minimap re-frames derive
   * theirs from content size, a different float almost every time). The floor
   * additionally keeps strokes on huge boards at the fully-zoomed-out weight
   * instead of washing out.
   */
  private _quantizeLineScale(multiplier: number): number {
    const step = Math.round(Math.log(multiplier) / Math.log(ZOOM_STEP_BASE));
    const clamped = Math.min(REFERENCE_STEP, Math.max(ZOOM_STEP_MIN, step));
    return Math.pow(ZOOM_STEP_BASE, clamped);
  }

  /**
   * Tiles the cached, theme-keyed {@link GridGraphics} context over the region
   * so the export grid matches the editor exactly. Every chunk shares one
   * context, so even a large region stays cheap. Chunks overhanging the region
   * are clipped by the texture bounds.
   */
  private _buildGrid(region: Rectangle, lineScale: number): Container {
    const gridSize = environment.gridSize;
    const context = this.graphicsProvider.getGraphicsContext(
      GridGraphics,
      GRID_CHUNK,
      lineScale
    );
    const container = new Container();
    const startX = Math.floor(region.x / GRID_CHUNK) * GRID_CHUNK;
    const startY = Math.floor(region.y / GRID_CHUNK) * GRID_CHUNK;
    const endX = region.x + region.width;
    const endY = region.y + region.height;
    for (let gx = startX; gx < endX; gx += GRID_CHUNK) {
      for (let gy = startY; gy < endY; gy += GRID_CHUNK) {
        const chunk = new Graphics(context);
        chunk.position.set(gx * gridSize, gy * gridSize);
        container.addChild(chunk);
      }
    }
    return container;
  }

  /** Re-tunes every content element's scale-dependent visuals (see `applyScale`). */
  private _applyContentScale(project: Project, scale: number): void {
    for (const component of project.components) component.applyScale(scale);
    for (const wire of project.wires) wire.applyScale(scale);
    project.connectionPoints.layer.applyScale(scale);
  }

  /** Collects every text node under a container. */
  private _collectTextNodes(container: Container): (Text | BitmapText)[] {
    const out: (Text | BitmapText)[] = [];
    const visit = (node: Container): void => {
      if (node instanceof Text || node instanceof BitmapText) out.push(node);
      for (const child of node.children) visit(child as Container);
    };
    visit(container);
    return out;
  }

  /** Hides every text node for the content pass; returns the restore. */
  private _hideTextNodes(container: Container): () => void {
    const nodes = this._collectTextNodes(container);
    const renderable = nodes.map((n) => n.renderable);
    for (const node of nodes) node.renderable = false;
    return () => nodes.forEach((n, i) => (n.renderable = renderable[i]));
  }

  /**
   * Bumps `Text` glyph resolution for the content pass; returns the restore.
   * `BitmapText` draws from the shared atlas and has no per-node resolution.
   */
  private _tuneTextResolution(
    container: Container,
    resolution: number
  ): () => void {
    const nodes = this._collectTextNodes(container).filter(
      (n): n is Text => n instanceof Text
    );
    const original = nodes.map((n) => n.resolution);
    for (const node of nodes) node.resolution = resolution;
    return () => nodes.forEach((n, i) => (n.resolution = original[i]));
  }
}
