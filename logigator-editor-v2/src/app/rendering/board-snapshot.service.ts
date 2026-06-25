import { inject, Injectable } from '@angular/core';
import {
  Container,
  Graphics,
  Matrix,
  Rectangle,
  RenderTexture,
  type ColorSource
} from 'pixi.js';
import { RendererHandleService } from './renderer-handle.service';
import { GraphicsProviderService } from './graphics-provider.service';
import { GridGraphics } from './graphics/grid.graphics';
import { ThemingService } from '../theming/theming.service';
import { Project } from '../project/project';
import { environment } from '../../environments/environment';

export type SnapshotBackground = 'grid' | 'solid' | 'transparent';

export interface SnapshotOptions {
  /** Output pixels per grid unit = `gridSize × multiplier`. */
  multiplier: number;
  /** `grid` = theme color + dot-grid, `solid` = theme color, `transparent`. */
  background: SnapshotBackground;
  /** Margin around content, in grid units. Defaults to {@link EXPORT_MARGIN_GRID}. */
  marginGrid?: number;
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
  private readonly rendererHandle = inject(RendererHandleService);
  private readonly graphicsProvider = inject(GraphicsProviderService);
  private readonly themingService = inject(ThemingService);

  /** Whether a renderer is registered (false before the board has loaded). */
  public get available(): boolean {
    return this.rendererHandle.available;
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
   * Renders a square-ish PNG preview of the project (longest side fit to
   * `sizePx`) for server-side thumbnails. Uses a solid theme background for a
   * clean thumbnail. Resolves `null` when no renderer is available so the save
   * flow can skip the upload silently.
   */
  public async generatePreview(
    project: Project,
    sizePx: number = PREVIEW_SIZE
  ): Promise<Blob | null> {
    if (!this.available) return null;
    const region = this.computeRegion(project);
    const longestUnits = Math.max(region.width, region.height);
    const multiplier = sizePx / (longestUnits * environment.gridSize);
    const canvas = this.renderProjectToCanvas(project, {
      multiplier,
      background: 'solid'
    });
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
    const renderer = this.rendererHandle.renderer;
    if (!renderer) {
      throw new Error('BoardSnapshotService: no renderer registered');
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
    const renderer = this.rendererHandle.renderer;
    if (!renderer) {
      throw new Error('BoardSnapshotService: no renderer registered');
    }

    const gridSize = environment.gridSize;
    const pxPerUnit = gridSize * options.multiplier;
    const { width, height } = this.outputSize(region, options.multiplier);

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
      // The export grid is authored in project-pixel space (gridSize px per
      // grid unit), so it scales by the multiplier only.
      grid = this._buildGrid(region, options.multiplier);
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

    // The CullerPlugin only runs on the on-screen ticker render, never on a
    // manual render-to-texture, so off-screen quad-tree entries keep last
    // frame's `culled` bit and would be missing here. Force the content subtree
    // visible; the next on-screen frame re-culls against the live viewport.
    this._uncull(project.gridSpace);
    project.setOverlayVisible(false);

    // Scale-dependent visuals (screen-constant strokes, Text glyph resolution)
    // are tuned to the live zoom. Re-tune them to the export scale so line
    // weights are zoom-independent and text stays crisp at high multipliers,
    // then restore. No flicker: nothing renders on-screen between the calls.
    const liveScale = project.scale.x;
    this._applyContentScale(project, options.multiplier);
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
      project.setOverlayVisible(true);
      grid?.destroy({ children: true });
    }

    return texture;
  }

  /**
   * Tiles the cached, theme-keyed {@link GridGraphics} context over the region
   * so the export grid matches the editor exactly. Every chunk shares one
   * context, so even a large region stays cheap. Chunks overhanging the region
   * are clipped by the texture bounds.
   */
  private _buildGrid(region: Rectangle, multiplier: number): Container {
    const gridSize = environment.gridSize;
    const context = this.graphicsProvider.getGraphicsContext(
      GridGraphics,
      GRID_CHUNK,
      multiplier
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

  private _uncull(container: Container): void {
    container.culled = false;
    for (const child of container.children) {
      this._uncull(child as Container);
    }
  }
}
