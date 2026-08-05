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
   * Hides every text node (`Text` and `BitmapText`) during the content pass
   * instead of re-tuning glyph resolution. For tiny outputs (minimap) where
   * glyphs are sub-pixel smears — shapes carry the layout, text is noise.
   */
  hideText?: boolean;
  /**
   * Renders this many times larger than `multiplier` asks for. Line weights
   * still come from `multiplier`, so a wire drawn one pixel wide at the
   * display size covers `supersample` pixels here and lands back at one after
   * the downscale — with its sub-pixel coverage averaged instead of quantized
   * to whole pixels.
   *
   * `renderRegionToCanvas` does the downscale and hands back a canvas at the
   * display size; `renderRegionToTexture` returns the enlarged texture and
   * leaves the downscale to the caller. Defaults to 1; see
   * {@link subPixelSupersample} for when it earns its quadratic cost.
   */
  supersample?: number;
  /**
   * Lifts the sub-pixel coverage a supersampled downscale leaves behind: the
   * result is composited over itself at this alpha, taking a pixel's coverage
   * from `a` to `a + k·a·(1-a)`. Defaults to 0 (off), and only applies where
   * there is a downscale to lift.
   *
   * Sub-pixel-wide wires rasterize as full-brightness color at partial
   * coverage, so what washes a shrunken board out is alpha, not color — which
   * is why a `brightness()`/`contrast()` filter can't lift it (both are
   * transfer functions on RGB alone). Self-compositing lifts the faint end
   * hardest and tapers to nothing as pixels approach solid, so content already
   * drawn at full coverage is untouched. It has no effect over an opaque
   * background, where the strokes are already blended in.
   *
   * This trades fidelity for legibility, so it belongs to viewing aids rather
   * than to output the user keeps: the minimap opts in, exports do not.
   *
   * Honored only on the WebGL renderer. Its pixel readback returns
   * premultiplied RGB that `putImageData` misreads as straight alpha
   * (upstream ships the unpremultiply step dead-coded), darkening every
   * partially covered pixel to `color·alpha` — the wash-out this boost was
   * calibrated against. WebGPU extracts keep coverage exact, so the same
   * lift there overshoots into a visibly denser map.
   */
  coverageBoost?: number;
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
 * Largest texture side (px) rendered in a single pass — conservative across
 * GPUs (WebGPU's `maxTextureDimension2D` defaults to 8192) and browser
 * 2D-canvas limits. Image export clamps its multiplier to this, and it bounds
 * what {@link BoardSnapshotService.subPixelSupersample} may enlarge to.
 */
export const MAX_SNAPSHOT_DIMENSION = 8192;
/** Supersample factor {@link BoardSnapshotService.subPixelSupersample} picks. */
const SUB_PIXEL_SUPERSAMPLE = 3;

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
   * How much to supersample a render, given what it would otherwise produce.
   *
   * Wires and port stubs are hairlines on the half-grid (`roundToHalfGrid` —
   * cell centres), so their centre-lines land at
   * `(g + 0.5 - region.x) × pxPerUnit`. When that is a whole number for every
   * `g` the output is already pixel-exact and supersampling would only soften
   * it — which is the case for every whole-number image-export multiplier
   * (16, 32, 64 px per grid unit). When it isn't — a fit-derived multiplier
   * like a square preview's — each hairline picks up its own sub-pixel phase,
   * antialiasing quantizes it to whatever coverage that phase gives, and the
   * result reads as uneven brightness that a filtered downscale evens out.
   *
   * Returns 1 rather than enlarging past `maxDimension`, so a render already
   * near the texture cap stays renderable.
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
   * the sub-pixel coverage the filtering leaves behind (see
   * {@link SnapshotOptions.coverageBoost}). Returns the source untouched when
   * there is nothing to downscale, and where the environment gives us nothing
   * to downscale *with* — an unsized canvas or no 2D context.
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
      // Compositing the downscaled result over itself, rather than blitting
      // the source a second time, keeps this a same-size copy instead of a
      // second filtered downscale.
      ctx.globalAlpha = coverageBoost;
      ctx.drawImage(target, 0, 0);
      ctx.globalAlpha = 1;
    }
    return target;
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
   * The non-live theme is produced by briefly switching the global theme and
   * restyling the project in place ({@link Component.refreshTheme} — the
   * live-toggle path; no rebuild, cheap even on large boards). All switching,
   * restyling and offscreen rendering happens synchronously, and the live
   * theme is restored in a `finally` *before* the first `await` — so no
   * wrong-theme frame can ever paint, effects never observe the temporary
   * theme, and no other consumer has to coordinate with this. Only the GPU
   * readbacks wait one frame, letting the queued render work drain so they
   * pay only their own transfer cost.
   */
  public async generatePreviews(
    project: Project,
    sizePx: number = PREVIEW_SIZE
  ): Promise<{ dark: Blob; light: Blob } | null> {
    if (!this.available || project.destroyed) return null;

    const region = this._squareRegion(this.computeRegion(project));
    const multiplier = sizePx / (region.width * environment.gridSize);
    // A preview's multiplier is fit-derived, so it practically never puts
    // hairlines on whole pixels — on a large board that is the difference
    // between a legible thumbnail and a faint smear.
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
        // Always restore the live theme, even if the pass throws — the caller
        // swallows errors, so a leaked theme switch would be silent and
        // baffling. Restyling is idempotent, so a half-restyled scene heals.
        this.themingService.setActiveThemeType(original);
        project.applyTheme(false);
      }
      liveTexture = this.renderRegionToTexture(project, region, options);

      // Both renders are queued on the GPU; reading back immediately would
      // block on that whole pipeline. Give it a frame to drain so the
      // readbacks below pay only their own transfer cost.
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
   * for — a supersampled render is downscaled here. See
   * {@link renderProjectToCanvas}.
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
    // Geometry renders at the supersampled scale while the line weights below
    // stay derived from `multiplier`, so every stroke comes out `supersample`
    // times its display thickness and the caller's downscale averages it back.
    const supersample = options.supersample ?? 1;
    const renderMultiplier = options.multiplier * supersample;
    const pxPerUnit = gridSize * renderMultiplier;
    const { width, height } = this.outputSize(region, renderMultiplier);

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
    project.applyContentScale(lineScale);
    const restoreText = options.hideText
      ? this._hideTextNodes(project.gridSpace)
      : this._tuneTextResolution(project.gridSpace, renderMultiplier);
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
      project.applyContentScale(liveScale);
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
