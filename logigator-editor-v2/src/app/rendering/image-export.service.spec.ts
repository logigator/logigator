import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Rectangle } from 'pixi.js';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  ImageExportService,
  MAX_EXPORT_DIMENSION
} from './image-export.service';
import { BoardSnapshotService } from './board-snapshot.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { ToastService } from '../logging/toast.service';
import { Project } from '../project/project';

const GRID_SIZE = 16;

function fakeCanvas(): HTMLCanvasElement {
  return {
    width: 10,
    height: 10,
    toBlob: (cb: BlobCallback) => cb(new Blob(['x']))
  } as unknown as HTMLCanvasElement;
}

describe('ImageExportService', () => {
  let service: ImageExportService;
  let snapshot: {
    available: boolean;
    computeRegion: Mock;
    outputSize: Mock;
    renderProjectToCanvas: Mock;
  };
  let toast: { error: Mock; warn: Mock; success: Mock; info: Mock };
  let downloads: string[];
  let clickSpy: Mock;
  const project = {} as unknown as Project;

  function setup(region: Rectangle): void {
    snapshot = {
      available: true,
      computeRegion: vi.fn(() => region),
      outputSize: vi.fn((r: Rectangle, m: number) => ({
        width: Math.round(r.width * GRID_SIZE * m),
        height: Math.round(r.height * GRID_SIZE * m)
      })),
      renderProjectToCanvas: vi.fn(() => fakeCanvas())
    };
    toast = { error: vi.fn(), warn: vi.fn(), success: vi.fn(), info: vi.fn() };
    configureTestBed([
      { provide: BoardSnapshotService, useValue: snapshot },
      {
        provide: ProjectMetadataStore,
        useValue: { getMetadata: () => ({ name: 'MyBoard' }) }
      },
      { provide: ToastService, useValue: toast }
    ]);
    service = TestBed.inject(ImageExportService);
  }

  beforeEach(() => {
    downloads = [];
    // jsdom/happy-dom don't implement object URLs; stub them and capture the
    // download via the anchor's click rather than letting it navigate.
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      }) as unknown as Mock;
    setup(new Rectangle(0, 0, 10, 10));
  });

  afterEach(() => vi.restoreAllMocks());

  it('computes the largest multiplier that fits the device limit', () => {
    // region longest = 10 × 16 = 160 px → 8192 / 160
    expect(service.maxMultiplier(project)).toBeCloseTo(
      MAX_EXPORT_DIMENSION / 160
    );
  });

  it('reports an error and skips rendering when no renderer is available', async () => {
    snapshot.available = false;
    await service.exportImage({
      project,
      format: 'png',
      multiplier: 1,
      background: true
    });
    expect(toast.error).toHaveBeenCalledOnce();
    expect(snapshot.renderProjectToCanvas).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('renders at the requested multiplier when within limits and downloads', async () => {
    await service.exportImage({
      project,
      format: 'png',
      multiplier: 2,
      background: true
    });
    expect(snapshot.renderProjectToCanvas).toHaveBeenCalledWith(project, {
      multiplier: 2,
      background: 'grid'
    });
    expect(downloads[0]).toBe('MyBoard.png');
    expect(toast.warn).not.toHaveBeenCalled();
  });

  it('clamps the multiplier and warns when the output exceeds the limit', async () => {
    // longest 1000 × 16 = 16000 px → max ≈ 0.512
    snapshot.computeRegion.mockReturnValue(new Rectangle(0, 0, 1000, 1000));
    await service.exportImage({
      project,
      format: 'png',
      multiplier: 2,
      background: true
    });
    const used = snapshot.renderProjectToCanvas.mock.calls[0][1].multiplier;
    expect(used).toBeLessThan(2);
    expect(used).toBeCloseTo(MAX_EXPORT_DIMENSION / 16000);
    expect(toast.warn).toHaveBeenCalledOnce();
  });

  it('maps background off to a transparent render', async () => {
    await service.exportImage({
      project,
      format: 'png',
      multiplier: 1,
      background: false
    });
    expect(snapshot.renderProjectToCanvas).toHaveBeenCalledWith(project, {
      multiplier: 1,
      background: 'transparent'
    });
  });

  it('uses the jpg extension and an explicit file name', async () => {
    await service.exportImage({
      project,
      format: 'jpeg',
      multiplier: 1,
      background: true,
      fileName: 'custom'
    });
    expect(downloads[0]).toBe('custom.jpg');
  });
});
