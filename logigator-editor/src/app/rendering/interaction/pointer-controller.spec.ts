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

  it('pans on a middle-button drag by successive deltas, never reaching the tool', () => {
    const button = 1; // middle
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
  });

  it('neither pans nor reaches the tool on a right-button drag', () => {
    controller.onPointerDown(mouse(1, 2, 200, 150));
    controller.onPointerMove(mouse(1, 2, 260, 150));
    controller.onPointerUp(mouse(1, 2, 260, 150));

    expect(nav.setActive).not.toHaveBeenCalled();
    expect(nav.pan).not.toHaveBeenCalled();
    expect(tool.down).not.toHaveBeenCalled();
    expect(tool.up).not.toHaveBeenCalled();
  });

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
    controller.onPointerDown(mouse(2, 1, 120, 70));

    expect(nav.setActive).not.toHaveBeenCalled();
    controller.onPointerMove(mouse(2, 1, 140, 90));
    expect(nav.pan).not.toHaveBeenCalled();
  });

  // One notch of 100 px is one zoom-button step.
  const notches = (n: number) => Math.pow(1.2, n);
  const lastZoom = () => vi.mocked(nav.zoomBy).mock.lastCall!;
  const lastPan = () => vi.mocked(nav.pan).mock.lastCall![0];

  describe('wheel', () => {
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

    it('scrolls the board and suppresses the page scroll', () => {
      at(0, { deltaY: 100 });
      expect(preventDefault).toHaveBeenCalled();
      expect(lastPan()).toMatchObject({ x: -0, y: -100 });

      at(1000, { deltaX: -30, deltaY: 12 });
      expect(lastPan()).toMatchObject({ x: 30, y: -12 });
      expect(nav.zoomBy).not.toHaveBeenCalled();
    });

    it('scrolls by lines and pages in pixels', () => {
      // Firefox's line mode: one notch of three lines.
      at(0, { deltaY: 3, deltaMode: 1 });
      expect(lastPan().y).toBeCloseTo(-100, 10);
      at(1000, { deltaY: 1, deltaMode: 2 });
      expect(lastPan().y).toBe(-800);
    });

    it('scrolls sideways with shift held, unless the browser swapped the axes', () => {
      at(0, { shiftKey: true, deltaY: 100 });
      expect(lastPan()).toMatchObject({ x: -100, y: -0 });

      at(1000, { shiftKey: true, deltaX: 100 });
      expect(lastPan()).toMatchObject({ x: -100, y: -0 });
    });

    it('ignores a wheel event that moves nothing', () => {
      at(0, {});
      at(1000, { shiftKey: true });
      expect(nav.pan).not.toHaveBeenCalled();
      expect(nav.zoomBy).not.toHaveBeenCalled();
    });

    it('zooms at the cursor with ctrl or cmd held', () => {
      at(0, { ctrlKey: true, deltaY: 100 });
      expect(lastZoom()[0]).toBeCloseTo(1 / notches(1), 10);
      expect(lastZoom()[1]).toMatchObject({ x: 32, y: 16 });

      at(1000, { metaKey: true, deltaY: -100 });
      expect(lastZoom()[0]).toBeCloseTo(notches(1), 10);
      expect(nav.pan).not.toHaveBeenCalled();
    });

    it('zooms in proportion to the delta, so merged and fine input are not lost', () => {
      // Five notches Chromium merged into one event over a slow frame.
      at(0, { metaKey: true, deltaY: 500 });
      expect(lastZoom()[0]).toBeCloseTo(1 / notches(5), 10);

      // Firefox's line mode: two notches of three lines each.
      at(1000, { ctrlKey: true, deltaY: -6, deltaMode: 1 });
      expect(lastZoom()[0]).toBeCloseTo(notches(2), 10);

      // A high-resolution wheel's fraction of a notch (Chromium on Linux).
      at(2000, { ctrlKey: true, deltaY: 53.333 });
      expect(lastZoom()[0]).toBeCloseTo(1 / notches(0.53333), 10);
    });

    it('zooms a ctrl-held mouse wheel by notches, not at the pinch rate', () => {
      at(0, { ctrlKey: true, deltaY: 3, deltaMode: 1 });
      expect(lastZoom()[0]).toBeCloseTo(1 / notches(1), 10);
    });
  });

  describe('trackpad input', () => {
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
    const gesture = (
      phase: 'start' | 'change' | 'end',
      timeStamp: number,
      scale: number
    ) => {
      const event = {
        clientX: 100 + 32,
        clientY: 50 + 16,
        scale,
        timeStamp,
        preventDefault: vi.fn()
      };
      if (phase === 'start') controller.onGestureStart(event);
      else if (phase === 'change') controller.onGestureChange(event);
      else controller.onGestureEnd(event);
      return event;
    };

    it('pans with a two-finger swipe, like a wheel', () => {
      at(0, { deltaX: 4, deltaY: -7 });
      expect(lastPan()).toMatchObject({ x: -4, y: 7 });
      expect(nav.zoomBy).not.toHaveBeenCalled();
    });

    it('zooms continuously with a pinch, at the pointer', () => {
      at(0, { ctrlKey: true, deltaY: -5 });

      expect(nav.zoomBy).toHaveBeenCalledTimes(1);
      const [factor, center] = vi.mocked(nav.zoomBy).mock.calls[0];
      expect(factor).toBeCloseTo(Math.exp(0.075), 10);
      expect(center).toMatchObject({ x: 32, y: 16 });
    });

    it('drops the finger drift a browser interleaves with a pinch', () => {
      at(0, { ctrlKey: true, deltaY: -5 });
      // The fingers' midpoint moving, sent between the pinch's own events.
      at(8, { deltaY: -3 });
      at(16, { ctrlKey: true, deltaY: -4 });
      at(24, { deltaX: 2, deltaY: 4 });

      // Only the pinch's own events zoom, each at the pinch rate.
      expect(vi.mocked(nav.zoomBy).mock.calls.map(([f]) => f)).toEqual([
        Math.exp(0.075),
        Math.exp(0.06)
      ]);
      expect(nav.pan).not.toHaveBeenCalled();

      // Once the pinch has ended, a swipe pans again.
      at(300, { deltaY: -3 });
      expect(nav.pan).toHaveBeenCalledTimes(1);
    });

    it("zooms with Safari's pinch by the change in scale, at the pointer", () => {
      const start = gesture('start', 0, 1);
      expect(start.preventDefault).toHaveBeenCalled();
      gesture('change', 16, 1.5);
      gesture('change', 32, 1.2);
      const end = gesture('end', 48, 1.2);
      expect(end.preventDefault).toHaveBeenCalled();

      const calls = vi.mocked(nav.zoomBy).mock.calls;
      expect(calls.map(([f]) => f)).toEqual([1.5, 1.2 / 1.5]);
      expect(calls[0][1]).toMatchObject({ x: 32, y: 16 });
    });

    it('counts a pinch once when Safari sends it as gestures and wheel alike', () => {
      gesture('start', 0, 1);
      at(8, { ctrlKey: true, deltaY: -5 });
      gesture('change', 16, 1.1);
      at(20, { deltaY: -2 });
      gesture('end', 32, 1.1);
      at(40, { ctrlKey: true, deltaY: -1 });

      expect(vi.mocked(nav.zoomBy).mock.calls.map(([f]) => f)).toEqual([1.1]);
      expect(nav.pan).not.toHaveBeenCalled();

      // A later pinch arriving as wheel events alone zooms again.
      at(1000, { ctrlKey: true, deltaY: -5 });
      expect(nav.zoomBy).toHaveBeenCalledTimes(2);
    });

    it('leaves a touchscreen pinch Safari also reports as gestures to the fingers', () => {
      controller.onPointerDown(touch(1, 110, 60));
      controller.onPointerDown(touch(2, 150, 60));
      gesture('start', 0, 1);
      gesture('change', 16, 2);

      expect(nav.zoomBy).not.toHaveBeenCalled();
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

  it('ends the tool stream as a cancel when a pressed pointer loses capture', () => {
    controller.onPointerDown(mouse(1, 0, 110, 60));
    controller.onLostPointerCapture({ pointerId: 1 });

    expect(tool.cancel).toHaveBeenCalledTimes(1);
    // The stream is over: its eventual release and moves go nowhere near it.
    controller.onPointerMove(mouse(1, 0, 120, 60));
    controller.onPointerUp(mouse(1, 0, 120, 60));
    expect(tool.move).not.toHaveBeenCalled();
    expect(tool.up).not.toHaveBeenCalled();

    // Ownership was dropped, so the next press starts a fresh stream.
    controller.onPointerDown(mouse(1, 0, 110, 60));
    expect(tool.down).toHaveBeenCalledTimes(2);
  });

  it('leaves a released stream alone when capture is lost after the pointer-up', () => {
    controller.onPointerDown(mouse(1, 0, 110, 60));
    controller.onPointerUp(mouse(1, 0, 110, 60));
    controller.onLostPointerCapture({ pointerId: 1 });

    expect(tool.up).toHaveBeenCalledTimes(1);
    expect(tool.cancel).not.toHaveBeenCalled();
  });

  it('ends a button pan when its pointer loses capture', () => {
    controller.onPointerDown(mouse(1, 1, 200, 150));
    controller.onLostPointerCapture({ pointerId: 1 });

    expect(nav.setActive).toHaveBeenLastCalledWith(false);
    controller.onPointerMove(mouse(1, 1, 210, 150));
    expect(nav.pan).not.toHaveBeenCalled();
  });

  it('cancels a stream whose release was lost when its pointer presses again', () => {
    controller.onPointerDown(mouse(1, 0, 110, 60));
    controller.onPointerDown(mouse(1, 0, 130, 60)); // no pointer-up between

    expect(tool.cancel).toHaveBeenCalledTimes(1);
    expect(tool.down).toHaveBeenCalledTimes(2);

    // The fresh press owns the stream now.
    controller.onPointerUp(mouse(1, 0, 130, 60));
    expect(tool.up).toHaveBeenCalledTimes(1);
  });

  it('ends a pan whose release was lost when its pointer presses again', () => {
    controller.onPointerDown(mouse(1, 1, 200, 150));
    controller.onPointerDown(mouse(1, 1, 300, 150)); // no pointer-up between

    expect(nav.setActive).toHaveBeenNthCalledWith(2, false);
    expect(nav.setActive).toHaveBeenLastCalledWith(true);
    // Deltas run from the fresh press, not from the lost stream's last point.
    controller.onPointerMove(mouse(1, 1, 310, 150));
    expect(vi.mocked(nav.pan).mock.calls[0][0]).toMatchObject({ x: 10, y: 0 });
  });

  it('keeps a pan when its pointer presses another button', () => {
    controller.onPointerDown(mouse(1, 1, 200, 150));
    controller.onPointerDown(mouse(1, 0, 200, 150));

    expect(tool.down).not.toHaveBeenCalled();
    expect(nav.setActive).toHaveBeenCalledTimes(1);
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
    expect(nav.pan).not.toHaveBeenCalled();
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
    expect(nav.pan).not.toHaveBeenCalled();
  });
});
