import { inject, Injectable } from '@angular/core';
import {
  BitmapText,
  Container,
  Graphics,
  Matrix,
  Rectangle,
  RendererType,
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
   * Hides every text node during the content pass, for outputs too small for
   * glyphs to read (minimap).
   */
  hideText?: boolean;
  /**
   * Renders this many times larger than `multiplier` asks for; line weights
   * still come from `multiplier`, so the downscale averages each stroke's
   * sub-pixel coverage instead of quantizing it. Defaults to 1.
   */
  supersample?: number;
  /**
   * Composites a downscaled result over itself at this alpha, lifting coverage
   * from `a` to `a + k·a·(1-a)`. Sub-pixel wires lose alpha, not color, so an
   * RGB transfer function cannot lift them. Trades fidelity for legibility:
   * viewing aids opt in, exports do not. Defaults to 0.
   *
   * WebGL only — its readback returns premultiplied RGB that `putImageData`
   * misreads as straight alpha, the wash-out this is calibrated against.
   * WebGPU extracts are exact and the same lift overshoots.
   */
  coverageBoost?: number;
}

/** Margin kept around the content bounds in a full-project snapshot. */
export const EXPORT_MARGIN_GRID = 1;
/** Fallback content box (grid units) used when the project is empty. */
export const EMPTY_FALLBACK_GRID = 16;
/** Default edge length (px) of a server-save preview. */
export const PREVIEW_SIZE = 1024;
/** Below this multiplier a preview hides text: glyphs are sub-pixel smears. */
const PREVIEW_HIDE_TEXT_BELOW = 0.5;
/** Grid units per export-grid chunk; matches the live {@link Grid}. */
const GRID_CHUNK = 32;
/**
 * The zoom-ladder step content renders at for multipliers ≥ 1 (the "100% zoom"
 * look). Decoupled from the live zoom so snapshots are deterministic and the
 * output matrix scales line weights with the multiplier.
 */
const REFERENCE_STEP = 0;
/**
 * Largest texture side (px) per pass — conservative across GPUs (WebGPU's
 * `maxTextureDimension2D` defaults to 8192) and 2D-canvas limits.
 */
export const MAX_SNAPSHOT_DIMENSION = 8192;
/** Supersample factor {@link BoardSnapshotService.subPixelSupersample} picks. */
const SUB_PIXEL_SUPERSAMPLE = 3;

/**
 * Renders a project's content into an offscreen `RenderTexture` — the
 * primitive behind image export, server previews and the minimap. It renders
 * the real scene graph, so every component type is covered with no per-type
 * code. Callers own the returned texture (`texture.destroy(true)`).
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
   * Hairlines sit on the half-grid, at `(g + 0.5 - region.x) × pxPerUnit`.
   * Whole ⇒ already pixel-exact, and supersampling would only soften it.
   * Otherwise each hairline picks up its own sub-pixel phase and reads as
   * uneven brightness that a filtered downscale evens out. Returns 1 rather
   * than enlarging past `maxDimension`.
   */
  public subPixelSupersample(
    region: Rectangle,
    multiplier: number,
    maxDimension: number = MAX_SNAPSHOT_DIMENSION
  ): number {
    const pxPerUnit = environment.gridSize * multiplier;
    const hairlineOffset = (0.5 - region.x) * pxPerUnit;
    if (Number.isInteger(pxPerUnit) && Number.isInteger(hairlineOffset)) {
      return 1;
    }
    const { width, height } = this.outputSize(
      region,
      multiplier * SUB_PIXEL_SUPERSAMPLE
    );
    return Math.max(width, height) <= maxDimension ? SUB_PIXEL_SUPERSAMPLE : 1;
  }

  /**
   * Downscales a supersampled canvas to its display size, optionally lifting
   * coverage (see {@link SnapshotOptions.coverageBoost}). Returns the source
   * untouched when there is nothing, or nothing to downscale with.
   */
  private _downsample(
    source: HTMLCanvasElement,
    supersample: number,
    coverageBoost = 0
  ): HTMLCanvasElement {
    if (supersample <= 1 || !source.width || !source.height) return source;
    const target = document.createElement('canvas');
    target.width = Math.max(1, Math.round(source.width / supersample));
    target.height = Math.max(1, Math.round(source.height / supersample));
    const ctx = target.getContext('2d');
    if (!ctx) return source;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, target.width, target.height);
    if (coverageBoost > 0) {
      // Compositing the target over itself keeps this a same-size copy
      // instead of a second filtered downscale.
      ctx.globalAlpha = coverageBoost;
      ctx.drawImage(target, 0, 0);
      ctx.globalAlpha = 1;
    }
    return target;
  }

  /** Content bounds + margin, or the empty fallback. Caller owns it. */
  public renderProjectToTexture(
    project: Project,
    options: SnapshotOptions
  ): RenderTexture {
    const region = this.computeRegion(project, options.marginGrid);
    return this.renderRegionToTexture(project, region, options);
  }

  /** As {@link renderProjectToTexture}, returning a standalone canvas. */
  public renderProjectToCanvas(
    project: Project,
    options: SnapshotOptions
  ): HTMLCanvasElement {
    const region = this.computeRegion(project, options.marginGrid);
    return this.renderRegionToCanvas(project, region, options);
  }

  /**
   * Dark- and light-themed square PNG previews with a transparent background
   * and the content centered. Resolves `null` when no renderer is available,
   * so the save flow skips the upload.
   *
   * The non-live theme comes from briefly switching the global theme and
   * restyling in place. Switch, restyle and offscreen render all happen
   * synchronously and the live theme is restored before the first `await`, so
   * no wrong-theme frame can paint and no effect observes it.
   */
  public async generatePreviews(
    project: Project,
    sizePx: number = PREVIEW_SIZE
  ): Promise<{ dark: Blob; light: Blob } | null> {
    if (!this.available || project.destroyed) return null;

    const region = this._squareRegion(this.computeRegion(project));
    const multiplier = sizePx / (region.width * environment.gridSize);
    // A preview's multiplier is fit-derived, so it practically never puts
    // hairlines on whole pixels.
    const supersample = this.subPixelSupersample(region, multiplier);
    const options: SnapshotOptions = {
      multiplier,
      background: 'transparent',
      hideText: multiplier < PREVIEW_HIDE_TEXT_BELOW,
      supersample
    };

    const original = this.themingService.currentThemeType();
    const other =
      original === ThemeType.DARK ? ThemeType.LIGHT : ThemeType.DARK;

    let otherTexture: RenderTexture | null = null;
    let liveTexture: RenderTexture | null = null;
    try {
      try {
        this.themingService.setActiveThemeType(other);
        project.applyTheme(false);
        otherTexture = this.renderRegionToTexture(project, region, options);
      } finally {
        // A leaked theme switch would be silent; restyling is idempotent, so
        // a half-restyled scene heals.
        this.themingService.setActiveThemeType(original);
        project.applyTheme(false);
      }
      liveTexture = this.renderRegionToTexture(project, region, options);

      // Let the queued render work drain, so the readbacks below pay only
      // their own transfer cost.
      await nextAnimationFrame();
      const renderer = this.rendererService.renderer;
      if (!renderer) return null;

      const [darkTexture, lightTexture] =
        original === ThemeType.DARK
          ? [liveTexture, otherTexture]
          : [otherTexture, liveTexture];
      const darkCanvas = this._downsample(
        renderer.extract.canvas({ target: darkTexture }) as HTMLCanvasElement,
        supersample
      );
      const lightCanvas = this._downsample(
        renderer.extract.canvas({ target: lightTexture }) as HTMLCanvasElement,
        supersample
      );
      const [dark, light] = await Promise.all([
        this._canvasToBlob(darkCanvas),
        this._canvasToBlob(lightCanvas)
      ]);
      return dark && light ? { dark, light } : null;
    } finally {
      otherTexture?.destroy(true);
      liveTexture?.destroy(true);
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

  /**
   * Renders a region into an `HTMLCanvasElement` at the size `multiplier` asks
   * for; a supersampled render is downscaled here.
   */
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
      const canvas = renderer.extract.canvas({
        target: texture
      }) as HTMLCanvasElement;
      return this._downsample(
        canvas,
        options.supersample ?? 1,
        // WebGL-readback compensation only — see SnapshotOptions.coverageBoost.
        renderer.type === RendererType.WEBGL ? options.coverageBoost : 0
      );
    } finally {
      texture.destroy(true);
    }
  }

  /**
   * Renders an arbitrary region (grid units) of a project into a texture. A
   * passed transform *replaces* the container's own transform, so the matrices
   * below bake in the `gridSize` scale `gridSpace` would otherwise apply.
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
    // Geometry renders at the supersampled scale while line weights stay
    // derived from `multiplier`, so the downscale averages each stroke back.
    const supersample = options.supersample ?? 1;
    const renderMultiplier = options.multiplier * supersample;
    const pxPerUnit = gridSize * renderMultiplier;
    const { width, height } = this.outputSize(region, renderMultiplier);

    // Drives line weights and grid-dot sizes. Capped at the 100% reference so
    // weights grow proportionally for multipliers ≥ 1; below 1 it tracks the
    // multiplier so strokes never go sub-pixel and wash the output out.
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
      // them by the multiplier.
      grid = this._buildGrid(region, lineScale);
      const gridMatrix = new Matrix()
        .scale(renderMultiplier, renderMultiplier)
        .translate(tx, ty);
      renderer.render({
        container: grid,
        transform: gridMatrix,
        target: texture,
        clearColor,
        clear: true
      });
    }

    // gridSpace children sit in grid units, so scale by gridSize × multiplier.
    const contentMatrix = new Matrix()
      .scale(pxPerUnit, pxPerUnit)
      .translate(tx, ty);

    // The cull pass runs only on the on-screen ticker render, so off-screen
    // quad-tree entries still carry last frame's `culled` bit and would be
    // missing here. The next on-screen frame re-culls.
    uncullTree(project.gridSpace);
    project.setOverlayVisible(false);

    // Render at `lineScale`, independent of the live zoom. Text is
    // pre-rasterized, so glyph resolution is bumped separately. Everything is
    // restored afterwards; nothing renders on-screen in between.
    const liveScale = project.scale.x;
    project.applyContentScale(lineScale);
    const restoreText = options.hideText
      ? this._hideTextNodes(project.gridSpace)
      : this._tuneTextResolution(project.gridSpace, renderMultiplier);
    // Selection is a tint on the real scene objects, so a snapshot taken with
    // a live selection would bake the highlight in.
    const restoreTint = project.selectionManager.suppressTintForRender();
    try {
      renderer.render({
        container: project.gridSpace,
        transform: contentMatrix,
        target: texture,
        clearColor,
        clear: !withGrid
      });
    } finally {
      restoreTint();
      project.applyContentScale(liveScale);
      restoreText();
      project.setOverlayVisible(true);
      grid?.destroy({ children: true });
    }

    return texture;
  }

  /**
   * Snaps a multiplier onto the live zoom ladder (`ZOOM_STEP_BASE^step`,
   * step ∈ [{@link ZOOM_STEP_MIN}, 0]), so the scale-keyed GraphicsContext
   * cache is reused rather than growing an entry per arbitrary multiplier.
   * The floor keeps strokes on huge boards at the fully-zoomed-out weight.
   */
  private _quantizeLineScale(multiplier: number): number {
    const step = Math.round(Math.log(multiplier) / Math.log(ZOOM_STEP_BASE));
    const clamped = Math.min(REFERENCE_STEP, Math.max(ZOOM_STEP_MIN, step));
    return Math.pow(ZOOM_STEP_BASE, clamped);
  }

  /**
   * Tiles the cached, theme-keyed {@link GridGraphics} context over the region
   * so the export grid matches the editor. Every chunk shares one context;
   * overhanging chunks are clipped by the texture bounds.
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
