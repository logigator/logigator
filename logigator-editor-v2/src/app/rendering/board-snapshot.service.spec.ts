import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BitmapText, Container, Renderer, RenderTexture } from 'pixi.js';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Project } from '../project/project';
import { makeAnd } from '../../testing/factories';
import { BoardSnapshotService } from './board-snapshot.service';
import { RendererService } from './renderer.service';
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
  let renderer: Renderer;
  let rendererService: {
    renderer: Renderer | null;
    available(): boolean;
    suspendPaints(): () => void;
  };
  let paintsSuspended: number;
  /** Suspension depth at the time of each render call. */
  let suspendedDuringRender: number[];

  function collectBitmapTexts(
    node: Container,
    out: BitmapText[] = []
  ): BitmapText[] {
    if (node instanceof BitmapText) out.push(node);
    for (const child of node.children) {
      collectBitmapTexts(child as Container, out);
    }
    return out;
  }

  beforeEach(() => {
    renderCalls = [];
    paintsSuspended = 0;
    suspendedDuringRender = [];
    renderer = {
      render: vi.fn((opts: RenderCall) => {
        renderCalls.push(opts);
        suspendedDuringRender.push(paintsSuspended);
      }),
      extract: {
        canvas: () =>
          ({
            toBlob: (cb: BlobCallback) => cb(new Blob(['x']))
          }) as unknown as HTMLCanvasElement
      }
    } as unknown as Renderer;
    rendererService = {
      renderer,
      available: () => rendererService.renderer !== null,
      suspendPaints: vi.fn(() => {
        paintsSuspended++;
        let resumed = false;
        return () => {
          if (!resumed) {
            resumed = true;
            paintsSuspended--;
          }
        };
      })
    };
    configureTestBed([{ provide: RendererService, useValue: rendererService }]);
    project = new Project();
    service = TestBed.inject(BoardSnapshotService);
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('reports availability from the renderer service', () => {
    expect(service.available).toBe(true);
    rendererService.renderer = null;
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

  it('quantizes sub-1 line scales onto the zoom ladder', () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const spy = vi.spyOn(comp, 'applyScale');

    const texture = service.renderProjectToTexture(project, {
      multiplier: 0.5,
      background: 'solid'
    });

    // Below 1× the weight scale tracks the multiplier, snapped to the nearest
    // ladder step (round(log₁.₂ 0.5) = -4) so the scale-keyed context cache
    // sees only scales the live zoom also produces.
    expect(spy.mock.calls.map((c) => c[0])).toContain(Math.pow(1.2, -4));
    texture.destroy(true);
  });

  it('floors the line scale at the ladder minimum for tiny multipliers', () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const spy = vi.spyOn(comp, 'applyScale');

    const texture = service.renderProjectToTexture(project, {
      multiplier: 0.001,
      background: 'solid'
    });

    // Strokes never re-tune below the fully-zoomed-out weight.
    expect(spy.mock.calls.map((c) => c[0])).toContain(Math.pow(1.2, -12));
    texture.destroy(true);
  });

  it('hideText hides text nodes during the content pass and restores them', () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const texts = collectBitmapTexts(project.gridSpace);
    expect(texts.length).toBeGreaterThan(0);

    let hiddenDuringRender = false;
    (renderer.render as Mock).mockImplementation((opts: RenderCall) => {
      renderCalls.push(opts);
      hiddenDuringRender = texts.every((t) => !t.renderable);
    });

    const texture = service.renderProjectToTexture(project, {
      multiplier: 0.1,
      background: 'transparent',
      hideText: true
    });

    expect(hiddenDuringRender).toBe(true);
    expect(texts.every((t) => t.renderable)).toBe(true);
    texture.destroy(true);
  });

  it('without hideText, text nodes stay renderable during the pass', () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const texts = collectBitmapTexts(project.gridSpace);
    expect(texts.length).toBeGreaterThan(0);

    let renderableDuringRender = false;
    (renderer.render as Mock).mockImplementation((opts: RenderCall) => {
      renderCalls.push(opts);
      renderableDuringRender = texts.every((t) => t.renderable);
    });

    const texture = service.renderProjectToTexture(project, {
      multiplier: 2,
      background: 'transparent'
    });

    expect(renderableDuringRender).toBe(true);
    texture.destroy(true);
  });

  it('generatePreviews returns null without a renderer', async () => {
    rendererService.renderer = null;
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
    // One render call per theme, each a transparent 512×512 square.
    const squareTransparent = renderCalls.filter(
      (c) =>
        c.target.width === 512 &&
        c.target.height === 512 &&
        Array.isArray(c.clearColor) &&
        (c.clearColor as number[]).every((v) => v === 0)
    );
    expect(squareTransparent.length).toBe(2);
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

  it('generatePreviews suspends on-screen paints across both scene passes', async () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);

    await service.generatePreviews(project, 512);

    // Both themed renders ran inside the suspension window, and the window
    // is closed again by the time the previews resolve.
    expect(suspendedDuringRender).toEqual([1, 1]);
    expect(paintsSuspended).toBe(0);
  });

  it('generatePreviews resumes paints even if a scene pass throws', async () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    vi.spyOn(project, 'applyTheme').mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(service.generatePreviews(project, 512)).rejects.toThrow();
    expect(paintsSuspended).toBe(0);
  });

  it('generatePreviews reports generatingPreviews while a run is in flight', async () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);

    const run = service.generatePreviews(project, 512);
    // The run starts on a microtask (behind the serialization chain).
    await Promise.resolve();
    expect(service.generatingPreviews()).toBe(true);

    await run;
    expect(service.generatingPreviews()).toBe(false);
  });

  it('generatePreviews serializes concurrent runs', async () => {
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    const theming = TestBed.inject(ThemingService);
    const switches = vi.spyOn(theming, 'setActiveThemeType');

    await Promise.all([
      service.generatePreviews(project, 512),
      service.generatePreviews(project, 512)
    ]);

    // Each run switches away and back within itself; interleaved runs would
    // mix the pairs (the scene bake is global state).
    const order = switches.mock.calls.map((c) => c[0]);
    const original = theming.currentThemeType();
    const other = order[0];
    expect(other).not.toBe(original);
    expect(order).toEqual([other, original, other, original]);
  });

  it('generatePreviews hides text when the content only fits at a tiny multiplier', async () => {
    // Two gates ~100 grid units apart force the 512px square to a multiplier
    // far below the hide-text threshold.
    const near = makeAnd(2);
    near.position.set(0, 0);
    project.addComponent(near);
    const far = makeAnd(2);
    far.position.set(100, 0);
    project.addComponent(far);

    // Text nodes are recreated by each theme redraw, so re-collect per render.
    const textStates: boolean[] = [];
    (renderer.render as Mock).mockImplementation((opts: RenderCall) => {
      renderCalls.push(opts);
      suspendedDuringRender.push(paintsSuspended);
      const texts = collectBitmapTexts(project.gridSpace);
      textStates.push(texts.length > 0 && texts.every((t) => !t.renderable));
    });

    await service.generatePreviews(project, 512);

    expect(textStates).toEqual([true, true]);
  });

  it('neutralizes the selection tint during the content pass and restores it', () => {
    const selectTint = TestBed.inject(ThemingService).currentTheme().selectTint;
    const comp = makeAnd(2);
    comp.position.set(0, 0);
    project.addComponent(comp);
    project.selectionManager.select([comp], []);
    expect(comp.tint).toBe(selectTint);

    let tintDuringRender: number | null = null;
    (renderer.render as Mock).mockImplementation((opts: RenderCall) => {
      renderCalls.push(opts);
      tintDuringRender = comp.tint;
    });

    const texture = service.renderProjectToTexture(project, {
      multiplier: 1,
      background: 'transparent'
    });

    // White (no highlight) while rendering; back to the selection tint after.
    expect(tintDuringRender).toBe(0xffffff);
    expect(comp.tint).toBe(selectTint);
    texture.destroy(true);
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
