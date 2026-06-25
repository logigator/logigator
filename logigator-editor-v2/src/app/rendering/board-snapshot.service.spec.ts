import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Renderer, RenderTexture } from 'pixi.js';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Project } from '../project/project';
import { makeAnd } from '../../testing/factories';
import { BoardSnapshotService } from './board-snapshot.service';
import { RendererHandleService } from './renderer-handle.service';
import { ThemingService } from '../theming/theming.service';

interface RenderCall {
  transform: { a: number; d: number; tx: number; ty: number };
  target: RenderTexture;
  clear: boolean;
  clearColor: unknown;
}

describe('BoardSnapshotService', () => {
  let project: Project;
  let service: BoardSnapshotService;
  let renderCalls: RenderCall[];

  beforeEach(() => {
    configureTestBed();
    project = new Project();

    renderCalls = [];
    const renderer = {
      render: vi.fn((opts: RenderCall) => renderCalls.push(opts)),
      extract: {
        canvas: () =>
          ({
            toBlob: (cb: BlobCallback) => cb(new Blob(['x']))
          }) as unknown as HTMLCanvasElement
      }
    } as unknown as Renderer;
    TestBed.inject(RendererHandleService).set(renderer);
    service = TestBed.inject(BoardSnapshotService);
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('reports availability from the renderer handle', () => {
    expect(service.available).toBe(true);
    TestBed.inject(RendererHandleService).set(null);
    expect(service.available).toBe(false);
  });

  it('sizes the texture to content bounds + margin × multiplier', () => {
    // AND at (3,0): gridBounds x∈[2.5,5.5], y∈[0,2]. Margin 1 → region (1.5,-1,5,4).
    const comp = makeAnd(2);
    comp.position.set(3, 0);
    project.addComponent(comp);

    const texture = service.renderProjectToTexture(project, {
      multiplier: 2,
      background: 'transparent'
    });

    // gridSize 16 × multiplier 2 = 32 px per grid unit.
    expect(texture.width).toBe(160); // 5 × 32
    expect(texture.height).toBe(128); // 4 × 32

    const content = renderCalls.at(-1)!;
    expect(content.transform.a).toBeCloseTo(32);
    expect(content.transform.d).toBeCloseTo(32);
    expect(content.transform.tx).toBeCloseTo(-48); // -region.x(1.5) × 32
    expect(content.transform.ty).toBeCloseTo(32); // -region.y(-1) × 32

    texture.destroy(true);
  });

  it('falls back to a fixed box for an empty project', () => {
    const texture = service.renderProjectToTexture(project, {
      multiplier: 1,
      background: 'transparent'
    });
    // Empty fallback 16×16 + margin 1 each side → 18 grid units × gridSize 16.
    expect(texture.width).toBe(18 * 16);
    expect(texture.height).toBe(18 * 16);
    texture.destroy(true);
  });

  it('transparent background: one content pass, cleared with rgba 0', () => {
    const texture = service.renderProjectToTexture(project, {
      multiplier: 1,
      background: 'transparent'
    });
    expect(renderCalls.length).toBe(1);
    expect(renderCalls[0].clear).toBe(true);
    expect(renderCalls[0].clearColor).toEqual([0, 0, 0, 0]);
    texture.destroy(true);
  });

  it('grid background: a grid pass clears, then content draws over it', () => {
    const texture = service.renderProjectToTexture(project, {
      multiplier: 1,
      background: 'grid'
    });
    expect(renderCalls.length).toBe(2);
    expect(renderCalls[0].clear).toBe(true); // grid pass clears
    expect(renderCalls[1].clear).toBe(false); // content composited over grid
    texture.destroy(true);
  });

  it('renders at the reference scale (not the multiplier) and restores live scale', () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const spy = vi.spyOn(comp, 'applyScale');

    const texture = service.renderProjectToTexture(project, {
      multiplier: 3,
      background: 'solid'
    });

    const scales = spy.mock.calls.map((c) => c[0]);
    expect(scales).toContain(1); // reference scale → proportional line weights
    expect(scales).not.toContain(3); // not scaled by the multiplier
    expect(scales.at(-1)).toBe(project.scale.x); // restored to live scale last
    texture.destroy(true);
  });

  it('floors line weights at the multiplier when below 1× so they stay visible', () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const spy = vi.spyOn(comp, 'applyScale');

    const texture = service.renderProjectToTexture(project, {
      multiplier: 0.5,
      background: 'solid'
    });

    // Below 1× the weight scale tracks the multiplier (min(1, 0.5) = 0.5),
    // keeping strokes ~1× px rather than going sub-pixel.
    expect(spy.mock.calls.map((c) => c[0])).toContain(0.5);
    texture.destroy(true);
  });

  it('generatePreviews returns null without a renderer', async () => {
    TestBed.inject(RendererHandleService).set(null);
    expect(await service.generatePreviews(project, 512)).toBeNull();
  });

  it('generatePreviews renders both themes, fits the size, and restores the theme', async () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const theming = TestBed.inject(ThemingService);
    const original = theming.currentThemeType();

    const previews = await service.generatePreviews(project, 512);

    expect(previews).not.toBeNull();
    expect(previews!.dark).toBeInstanceOf(Blob);
    expect(previews!.light).toBeInstanceOf(Blob);
    // One render call per theme, each fit to 512 on the longest side.
    const sized = renderCalls.filter(
      (c) => Math.max(c.target.width, c.target.height) === 512
    );
    expect(sized.length).toBe(2);
    // Both themes were visited and the original restored.
    expect(theming.currentThemeType()).toBe(original);
  });

  it('generatePreviews restores the theme even if rendering throws', async () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const theming = TestBed.inject(ThemingService);
    const original = theming.currentThemeType();
    vi.spyOn(project, 'applyTheme').mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(service.generatePreviews(project, 512)).rejects.toThrow();
    expect(theming.currentThemeType()).toBe(original);
  });

  it('restores overlay visibility after rendering', () => {
    const spy = vi.spyOn(project, 'setOverlayVisible');
    const texture = service.renderProjectToTexture(project, {
      multiplier: 1,
      background: 'solid'
    });
    expect(spy).toHaveBeenNthCalledWith(1, false);
    expect(spy).toHaveBeenNthCalledWith(2, true);
    texture.destroy(true);
  });
});
