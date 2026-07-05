import { inject, Injectable } from '@angular/core';
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
 * primitive behind image export, server previews and (later) a minimap: it
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
   * Renders dark- and light-themed PNG previews of the project for server-side
   * thumbnails: a square `sizePx × sizePx` image with a **transparent**
   * background and the content centered. Resolves `null` when no renderer is
   * available so the save flow can skip the upload silently.
   *
   * Theme colors are baked into cached graphics, so each theme is produced by
   * briefly switching the global theme and redrawing the project (the same path
   * a live theme toggle uses). All switching + offscreen rendering happens
   * synchronously and the original theme is restored in a `finally` *before* the
   * first `await`, so no wrong-theme frame can paint on the live canvas.
   */
  public async generatePreviews(
    project: Project,
    sizePx: number = PREVIEW_SIZE
  ): Promise<{ dark: Blob; light: Blob } | null> {
    if (!this.available) return null;

    const original = this.themingService.currentThemeType();
    let darkCanvas!: HTMLCanvasElement;
    let lightCanvas!: HTMLCanvasElement;
    try {
      darkCanvas = this._renderThemedPreview(project, ThemeType.DARK, sizePx);
      lightCanvas = this._renderThemedPreview(project, ThemeType.LIGHT, sizePx);
    } finally {
      // Always restore the live theme, even if a render throws — the caller
      // swallows errors, so a leaked theme switch would be silent and baffling.
      this._applyThemeForRender(project, original);
    }

    const dark = await this._canvasToBlob(darkCanvas);
    const light = await this._canvasToBlob(lightCanvas);
    return dark && light ? { dark, light } : null;
  }

  private _renderThemedPreview(
    project: Project,
    theme: ThemeType,
    sizePx: number
  ): HTMLCanvasElement {
    this._applyThemeForRender(project, theme);
    const region = this._squareRegion(this.computeRegion(project));
    const multiplier = sizePx / (region.width * environment.gridSize);
    return this.renderRegionToCanvas(project, region, {
      multiplier,
      background: 'transparent'
    });
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

  /** Switches the global theme and redraws the project without a screen tick. */
  private _applyThemeForRender(project: Project, theme: ThemeType): void {
    this.themingService.setActiveThemeType(theme);
    project.applyTheme(false);
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
    // export matches the natural look: the matrix scales line weights up
    // proportionally with the multiplier (higher resolution = the same picture
    // with more pixels, not thinner lines) while the `lineScale` floor keeps
    // them visible below 1×. Text is a pre-rasterized texture, so its glyph
    // resolution is bumped to the multiplier separately to stay crisp — or
    // hidden outright (`hideText`) for outputs too small to render glyphs.
    // Everything is restored afterwards — no flicker, nothing renders on-screen
    // between the calls.
    const liveScale = project.scale.x;
    this._applyContentScale(project, lineScale);
    const restoreText = options.hideText
      ? this._hideTextNodes(project.gridSpace)
      : this._tuneTextResolution(project.gridSpace, options.multiplier);
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
