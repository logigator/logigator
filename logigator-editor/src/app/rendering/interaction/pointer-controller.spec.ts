import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Point } from 'pixi.js';
import { environment } from '../../../environments/environment';
import { Project } from '../../project/project';
import {
  PointerController,
  PointerEventLike,
  PointerNavTarget,
  WheelEventLike,
  PointerToolTarget
} from './pointer-controller';

const gs = environment.gridSize;

/** A DOM listener the controller registered on the canvas, by event type. */
type CanvasListener = (event: {
  button: number;
  preventDefault(): void;
}) => void;

function makeCanvas(): {
  canvas: HTMLCanvasElement;
  listeners: Map<string, CanvasListener>;
} {
  const listeners = new Map<string, CanvasListener>();
  const canvas = {
    addEventListener: vi.fn((type: string, listener: CanvasListener) =>
      listeners.set(type, listener)
    ),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 100, top: 50 })
  } as unknown as HTMLCanvasElement;
  return { canvas, listeners };
}

/** A stand-in exposing only the viewport transform canvasToGrid reads. */
function makeProject(): Project {
  return {
    position: new Point(0, 0),
    scale: new Point(1, 1)
  } as unknown as Project;
}

function mouse(
  pointerId: number,
  button: number,
  clientX: number,
  clientY: number,
  timeStamp = 0
): PointerEventLike {
  return {
    pointerId,
    pointerType: 'mouse',
    button,
    clientX,
    clientY,
    timeStamp
  };
}

function touch(
  pointerId: number,
  clientX: number,
  clientY: number,
  timeStamp = 0
): PointerEventLike {
  return {
    pointerId,
    pointerType: 'touch',
    button: 0,
    clientX,
    clientY,
    timeStamp
  };
}

describe('PointerController', () => {
  let canvas: HTMLCanvasElement;
  let listeners: Map<string, CanvasListener>;
  let project: Project;
  let nav: PointerNavTarget;
  let tool: Required<PointerToolTarget>;
  let controller: PointerController;

  beforeEach(() => {
    ({ canvas, listeners } = makeCanvas());
    project = makeProject();
    nav = {
      pan: vi.fn(),
      scroll: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      zoomBy: vi.fn(),
      setActive: vi.fn()
    };
    tool = {
      down: vi.fn(),
      move: vi.fn(),
      up: vi.fn(),
      cancel: vi.fn(),
      hover: vi.fn(),
      leave: vi.fn()
    };
    controller = new PointerController({
      canvas,
      project: () => project,
      nav,
      tool
    });
  });

  it('streams a primary press to the tool target with canvas-local and grid points', () => {
    controller.onPointerDown(mouse(1, 0, 100 + 2 * gs, 50 + 3 * gs));

    expect(tool.down).toHaveBeenCalledTimes(1);
    const input = vi.mocked(tool.down).mock.calls[0][0];
    expect(input.global).toMatchObject({ x: 2 * gs, y: 3 * gs });
    expect(input.grid).toMatchObject({ x: 2, y: 3 });
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);

    controller.onPointerMove(mouse(1, 0, 100 + 4 * gs, 50 + 3 * gs));
    expect(tool.move).toHaveBeenCalledTimes(1);
    expect(vi.mocked(tool.move).mock.calls[0][0].grid).toMatchObject({
      x: 4,
      y: 3
    });

    controller.onPointerUp(mouse(1, 0, 100 + 4 * gs, 50 + 3 * gs));
    expect(tool.up).toHaveBeenCalledTimes(1);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('routes moves without a pressed pointer to hover', () => {
    controller.onPointerMove(mouse(7, -1, 110, 60));
    expect(tool.hover).toHaveBeenCalledTimes(1);
    expect(tool.move).not.toHaveBeenCalled();
  });

  it.each([2, 1])(
    'button-%i drag pans by successive deltas and never reaches the tool',
    (button) => {
      controller.onPointerDown(mouse(1, button, 200, 150));
      expect(tool.down).not.toHaveBeenCalled();
      expect(nav.setActive).toHaveBeenCalledWith(true);

      controller.onPointerMove(mouse(1, button, 210, 145));
      expect(nav.pan).toHaveBeenCalledTimes(1);
      expect(vi.mocked(nav.pan).mock.calls[0][0]).toMatchObject({
        x: 10,
        y: -5
      });

      controller.onPointerMove(mouse(1, button, 230, 145));
      expect(vi.mocked(nav.pan).mock.calls[1][0]).toMatchObject({
        x: 20,
        y: 0
      });

      controller.onPointerUp(mouse(1, button, 230, 145));
      expect(nav.setActive).toHaveBeenCalledWith(false);
      expect(tool.up).not.toHaveBeenCalled();
    }
  );

  it('suppresses the middle press default and leaves the primary one alone', () => {
    const mousedown = listeners.get('mousedown');
    expect(mousedown).toBeDefined();

    const middle = { button: 1, preventDefault: vi.fn() };
    const primary = { button: 0, preventDefault: vi.fn() };
    mousedown?.(middle);
    mousedown?.(primary);

    expect(middle.preventDefault).toHaveBeenCalled();
    expect(primary.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores a second button while an interaction is active', () => {
    controller.onPointerDown(mouse(1, 0, 110, 60));
    controller.onPointerDown(mouse(2, 2, 120, 70));

    expect(nav.setActive).not.toHaveBeenCalled();
    controller.onPointerMove(mouse(2, 2, 140, 90));
    expect(nav.pan).not.toHaveBeenCalled();
  });

  // One notch of 100 px is one zoom-button step.
  const notches = (n: number) => Math.pow(1.2, n);
  const lastZoom = () => vi.mocked(nav.zoomBy).mock.lastCall!;

  it('zooms at the cursor on wheel and suppresses the page scroll', () => {
    const preventDefault = vi.fn();
    controller.onWheel({
      clientX: 100 + 32,
      clientY: 50 + 16,
      deltaY: 100,
      preventDefault
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(lastZoom()[0]).toBeCloseTo(1 / notches(1), 10);
    expect(lastZoom()[1]).toMatchObject({ x: 32, y: 16 });

    controller.onWheel({
      clientX: 100,
      clientY: 50,
      deltaY: -100,
      preventDefault
    });
    expect(lastZoom()[0]).toBeCloseTo(notches(1), 10);
  });

  it('zooms in proportion to the delta, so merged and fine input are not lost', () => {
    const preventDefault = vi.fn();
    // Five notches Chromium merged into one event over a slow frame.
    controller.onWheel({
      clientX: 100,
      clientY: 50,
      deltaY: 500,
      preventDefault
    });
    expect(lastZoom()[0]).toBeCloseTo(1 / notches(5), 10);

    // Firefox's line mode: two notches of three lines each.
    controller.onWheel({
      clientX: 100,
      clientY: 50,
      deltaY: -6,
      deltaMode: 1,
      preventDefault
    });
    expect(lastZoom()[0]).toBeCloseTo(notches(2), 10);

    // A high-resolution wheel's fraction of a notch.
    controller.onWheel({
      clientX: 100,
      clientY: 50,
      deltaY: -25,
      preventDefault
    });
    expect(lastZoom()[0]).toBeCloseTo(notches(0.25), 10);
  });

  it('zooms, not pans, for a high-resolution wheel reporting fractional deltas', () => {
    // Chromium on Linux: a notch of a high-resolution wheel, no horizontal part.
    controller.onWheel({
      clientX: 100,
      clientY: 50,
      deltaY: 53.333,
      deltaX: 0,
      preventDefault: vi.fn()
    });
    expect(nav.scroll).not.toHaveBeenCalled();
    expect(lastZoom()[0]).toBeCloseTo(1 / notches(0.53333), 10);
  });

  it('ignores a wheel event with no vertical delta', () => {
    controller.onWheel({
      clientX: 100,
      clientY: 50,
      deltaY: 0,
      preventDefault: vi.fn()
    });
    expect(nav.zoomBy).not.toHaveBeenCalled();
  });

  describe('trackpad wheel input', () => {
    const preventDefault = vi.fn();
    const at = (timeStamp: number, fields: Partial<WheelEventLike>) =>
      controller.onWheel({
        clientX: 100 + 32,
        clientY: 50 + 16,
        deltaY: 0,
        preventDefault,
        timeStamp,
        ...fields
      });

    it('pans with a two-finger scroll instead of zooming', () => {
      at(0, { deltaX: 4, deltaY: -7 });

      expect(nav.scroll).toHaveBeenCalledTimes(1);
      expect(vi.mocked(nav.scroll).mock.calls[0][0]).toMatchObject({
        x: -4,
        y: 7
      });
      expect(nav.zoomBy).not.toHaveBeenCalled();
    });

    it('keeps panning for the rest of a burst once it has shown a trackpad', () => {
      // Vertical only: no evidence of a trackpad yet, so it zooms.
      at(0, { deltaY: 40 });
      expect(nav.zoomBy).toHaveBeenCalledTimes(1);

      at(16, { deltaX: 1, deltaY: 30 });
      at(32, { deltaY: 40 });
      expect(nav.scroll).toHaveBeenCalledTimes(2);
      expect(nav.zoomBy).toHaveBeenCalledTimes(1);

      // A pause ends the burst: the next notch is a wheel again.
      at(400, { deltaY: 100 });
      expect(nav.zoomBy).toHaveBeenCalledTimes(2);
      expect(nav.scroll).toHaveBeenCalledTimes(2);
    });

    it('zooms continuously with a pinch, at the pinch center', () => {
      at(0, { ctrlKey: true, deltaY: -5 });

      expect(nav.zoomBy).toHaveBeenCalledTimes(1);
      const [factor, center] = vi.mocked(nav.zoomBy).mock.calls[0];
      expect(factor).toBeCloseTo(Math.exp(0.05), 10);
      expect(center).toMatchObject({ x: 32, y: 16 });
    });

    it('zooms a ctrl-held mouse wheel in pixels at the wheel rate, not the pinch rate', () => {
      at(0, { ctrlKey: true, deltaY: 100 });
      expect(lastZoom()[0]).toBeCloseTo(1 / notches(1), 10);
    });

    it('zooms a ctrl-held mouse wheel by notches, not at the pinch rate', () => {
      at(0, { ctrlKey: true, deltaY: 3, deltaMode: 1 });
      expect(lastZoom()[0]).toBeCloseTo(1 / notches(1), 10);
    });
  });

  it('a second finger cancels the tool stream and pans as a gesture', () => {
    controller.onPointerDown(touch(1, 110, 60));
    expect(tool.down).toHaveBeenCalledTimes(1);

    controller.onPointerDown(touch(2, 130, 60));
    expect(tool.cancel).toHaveBeenCalledTimes(1);
    expect(nav.setActive).toHaveBeenCalledWith(true);

    controller.onPointerMove(touch(1, 120, 60));
    expect(nav.pan).toHaveBeenCalled();
    expect(tool.move).not.toHaveBeenCalled();

    controller.onPointerUp(touch(1, 120, 60));
    controller.onPointerUp(touch(2, 130, 60));
    expect(nav.setActive).toHaveBeenCalledWith(false);
  });

  it('pointercancel on the tool pointer cancels the session', () => {
    controller.onPointerDown(mouse(1, 0, 110, 60));
    controller.onPointerCancel(mouse(1, 0, 110, 60));

    expect(tool.cancel).toHaveBeenCalledTimes(1);
    expect(tool.up).not.toHaveBeenCalled();
  });

  it('counts quick presses in the same spot as one click run', () => {
    controller.onPointerDown(mouse(1, 0, 110, 60, 1000));
    controller.onPointerUp(mouse(1, 0, 110, 60, 1020));
    controller.onPointerDown(mouse(1, 0, 110, 60, 1300));
    controller.onPointerUp(mouse(1, 0, 110, 60, 1320));
    controller.onPointerDown(mouse(1, 0, 110, 60, 1600));

    const counts = vi
      .mocked(tool.down)
      .mock.calls.map(([input]) => input.clickCount);
    expect(counts).toEqual([1, 2, 3]);
  });

  it.each([
    ['the window has passed', 1501, 110],
    ['the press lands somewhere else', 1200, 130]
  ])('starts a new run when %s', (_case, timeStamp, clientX) => {
    controller.onPointerDown(mouse(1, 0, 110, 60, 1000));
    controller.onPointerUp(mouse(1, 0, 110, 60, 1010));
    controller.onPointerDown(mouse(1, 0, clientX, 60, timeStamp));

    expect(vi.mocked(tool.down).mock.calls[1][0].clickCount).toBe(1);
  });

  it('reports cursor grid positions as fresh clones', () => {
    const positions: Point[] = [];
    controller = new PointerController({
      canvas,
      project: () => project,
      nav,
      tool,
      onCursorMove: (grid) => positions.push(grid)
    });

    controller.onPointerMove(mouse(1, -1, 100 + gs, 50));
    controller.onPointerMove(mouse(1, -1, 100 + 2 * gs, 50));

    expect(positions[0]).toMatchObject({ x: 1, y: 0 });
    expect(positions[1]).toMatchObject({ x: 2, y: 0 });
  });

  it('drops all events while no project is active', () => {
    controller = new PointerController({
      canvas,
      project: () => null,
      nav,
      tool
    });

    controller.onPointerDown(mouse(1, 0, 110, 60));
    controller.onPointerMove(mouse(1, 0, 120, 60));
    controller.onWheel({
      clientX: 110,
      clientY: 60,
      deltaY: 120,
      preventDefault: vi.fn()
    });

    expect(tool.down).not.toHaveBeenCalled();
    expect(tool.hover).not.toHaveBeenCalled();
    expect(nav.zoomBy).not.toHaveBeenCalled();
  });

  // A disposed project stays reachable until the host re-homes the
  // controller, and mapping a canvas point through it would throw.
  it('drops all events while the project is destroyed', () => {
    controller = new PointerController({
      canvas,
      project: () => ({ destroyed: true }) as unknown as Project,
      nav,
      tool
    });

    controller.onPointerDown(mouse(1, 0, 110, 60));
    controller.onPointerMove(mouse(1, 0, 120, 60));
    controller.onPointerUp(mouse(1, 0, 120, 60));
    controller.onWheel({
      clientX: 110,
      clientY: 60,
      deltaY: -120,
      preventDefault: vi.fn()
    });

    expect(tool.down).not.toHaveBeenCalled();
    expect(tool.move).not.toHaveBeenCalled();
    expect(tool.hover).not.toHaveBeenCalled();
    expect(tool.up).not.toHaveBeenCalled();
    expect(nav.zoomBy).not.toHaveBeenCalled();
  });
});
