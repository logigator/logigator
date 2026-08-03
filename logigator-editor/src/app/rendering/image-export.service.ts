import { inject, Injectable } from '@angular/core';
import { Rectangle } from 'pixi.js';
import { TranslationService } from '../translation/translation.service';
import { Project } from '../project/project';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { ToastService } from '../logging/toast.service';
import {
  BoardSnapshotService,
  MAX_SNAPSHOT_DIMENSION,
  SnapshotBackground
} from './board-snapshot.service';
import { downloadBlob } from '../utils/download';
import { environment } from '../../environments/environment';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEvent } from '../analytics/analytics.mapping';

export type ImageFormat = 'png' | 'jpeg' | 'webp';

export interface ImageExportOptions {
  project: Project;
  format: ImageFormat;
  /** Output pixels per grid unit = `gridSize × multiplier`. */
  multiplier: number;
  /** `true` = theme color + dot-grid; `false` = transparent (png/webp) / white (jpeg). */
  background: boolean;
  /** 0–1, applied to jpeg/webp. */
  quality?: number;
  /** File name without extension; defaults to the project's metadata name. */
  fileName?: string;
}

/**
 * Largest texture side (px) rendered in a single pass. Beyond it the multiplier
 * is clamped and the user warned, rather than tiling. Shared with the snapshot
 * service, which bounds its supersampling by the same cap.
 */
export const MAX_EXPORT_DIMENSION = MAX_SNAPSHOT_DIMENSION;

const MIME: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp'
};
const EXTENSION: Record<ImageFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp'
};
const DEFAULT_QUALITY = 0.92;
const DEFAULT_NAME = 'circuit';

/**
 * Exports a project's canvas as a downloadable PNG / JPEG / WebP. Orchestration
 * only — the actual rendering and pixel extraction live in
 * {@link BoardSnapshotService}.
 */
@Injectable({
  providedIn: 'root'
})
export class ImageExportService {
  private readonly snapshot = inject(BoardSnapshotService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly analytics = inject(AnalyticsService);

  /**
   * Largest multiplier whose output fits {@link MAX_EXPORT_DIMENSION} on both
   * axes. Used to clamp the export and to drive the dialog's dimension preview.
   */
  public maxMultiplier(project: Project): number {
    return this._maxMultiplier(this.snapshot.computeRegion(project));
  }

  /**
   * Output dimensions for a project at a multiplier, with the effective
   * (possibly clamped) value applied. Drives the dialog's live size preview and
   * needs no renderer (bounds-only).
   */
  public previewSize(
    project: Project,
    multiplier: number
  ): { width: number; height: number; clamped: boolean } {
    const region = this.snapshot.computeRegion(project);
    const effective = Math.min(multiplier, this._maxMultiplier(region));
    return {
      ...this.snapshot.outputSize(region, effective),
      clamped: effective < multiplier
    };
  }

  public async exportImage(options: ImageExportOptions): Promise<void> {
    if (!this.snapshot.available) {
      this.toast.error(
        this.translation.translate('imageExport.error.unavailable'),
        'ImageExportService'
      );
      return;
    }

    const region = this.snapshot.computeRegion(options.project);
    const max = this._maxMultiplier(region);
    const effective = Math.min(options.multiplier, max);
    const clamped = effective < options.multiplier;

    let canvas: HTMLCanvasElement;
    try {
      canvas = this.snapshot.renderProjectToCanvas(options.project, {
        multiplier: effective,
        background: this._backgroundMode(options),
        // Inert at the dialog's whole-number resolutions, which already put
        // hairlines on whole pixels; earns its cost only if a fit-derived
        // multiplier ever reaches here with room under the dimension cap.
        supersample: this.snapshot.subPixelSupersample(
          region,
          effective,
          MAX_EXPORT_DIMENSION
        )
      });
    } catch (err) {
      this.toast.error(
        this.translation.translate('imageExport.error.failed'),
        'ImageExportService',
        err
      );
      return;
    }

    const blob = await this._toBlob(canvas, options);
    if (!blob) {
      this.toast.error(
        this.translation.translate('imageExport.error.failed'),
        'ImageExportService'
      );
      return;
    }

    const name =
      options.fileName ??
      this.metadataStore.getMetadata(options.project)?.name ??
      DEFAULT_NAME;
    downloadBlob(blob, `${name}.${EXTENSION[options.format]}`);

    this.analytics.capture(AnalyticsEvent.ProjectExported, {
      format: options.format,
      background: options.background
    });

    // A clamped export still succeeded; the clamp warning both confirms it and
    // explains the reduced size, so it stands in for the success toast.
    if (clamped) {
      const { width, height } = this.snapshot.outputSize(region, effective);
      this.toast.warn(
        this.translation.translate('imageExport.warn.clamped', {
          width,
          height
        }),
        'ImageExportService'
      );
    } else {
      this.toast.success(
        this.translation.translate('imageExport.success'),
        'ImageExportService'
      );
    }
  }

  private _backgroundMode(options: ImageExportOptions): SnapshotBackground {
    if (options.background) return 'grid';
    // JPEG has no alpha; flattening onto white happens in _toBlob, so render
    // transparent here regardless of format.
    return 'transparent';
  }

  private _maxMultiplier(region: Rectangle): number {
    const longestPx =
      Math.max(region.width, region.height) * environment.gridSize;
    return MAX_EXPORT_DIMENSION / longestPx;
  }

  private _toBlob(
    canvas: HTMLCanvasElement,
    options: ImageExportOptions
  ): Promise<Blob | null> {
    const source =
      options.format === 'jpeg' && !options.background
        ? this._flattenOnWhite(canvas)
        : canvas;
    const quality = options.quality ?? DEFAULT_QUALITY;
    return new Promise((resolve) =>
      source.toBlob((blob) => resolve(blob), MIME[options.format], quality)
    );
  }

  /** JPEG cannot store alpha; composite a transparent render onto white. */
  private _flattenOnWhite(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    return flat;
  }
}
