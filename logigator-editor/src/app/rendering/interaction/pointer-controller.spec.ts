import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Point } from 'pixi.js';
import { environment } from '../../../environments/environment';
import { Project } from '../../project/project';
import {
  PointerController,
  PointerEventLike,
  PointerNavTarget,
  PointerToolTarget
} from './pointer-controller';

const gs = environment.gridSize;

function makeCanvas(): HTMLCanvasElement {
  return {
    addEventListener: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 100, top: 50 })
  } as unknown as HTMLCanvasElement;
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
  clientY: number
): PointerEventLike {
  return { pointerId, pointerType: 'mouse', button, clientX, clientY };
}

function touch(
  pointerId: number,
  clientX: number,
  clientY: number
): PointerEventLike {
  return { pointerId, pointerType: 'touch', button: 0, clientX, clientY };
}

describe('PointerController', () => {
  let canvas: HTMLCanvasElement;
  let project: Project;
  let nav: PointerNavTarget;
  let tool: Required<PointerToolTarget>;
  let controller: PointerController;

  beforeEach(() => {
    canvas = makeCanvas();
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

  it('right-drag pans by successive deltas and never reaches the tool', () => {
    controller.onPointerDown(mouse(1, 2, 200, 150));
    expect(tool.down).not.toHaveBeenCalled();
    expect(nav.setActive).toHaveBeenCalledWith(true);

    controller.onPointerMove(mouse(1, 2, 210, 145));
    expect(nav.pan).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nav.pan).mock.calls[0][0]).toMatchObject({ x: 10, y: -5 });

    controller.onPointerMove(mouse(1, 2, 230, 145));
    expect(vi.mocked(nav.pan).mock.calls[1][0]).toMatchObject({ x: 20, y: 0 });

    controller.onPointerUp(mouse(1, 2, 230, 145));
    expect(nav.setActive).toHaveBeenCalledWith(false);
    expect(tool.up).not.toHaveBeenCalled();
  });

  it('ignores a second button while an interaction is active', () => {
    controller.onPointerDown(mouse(1, 0, 110, 60));
    controller.onPointerDown(mouse(2, 2, 120, 70));

    expect(nav.setActive).not.toHaveBeenCalled();
    controller.onPointerMove(mouse(2, 2, 140, 90));
    expect(nav.pan).not.toHaveBeenCalled();
  });

  it('zooms at the cursor on wheel and suppresses the page scroll', () => {
    const preventDefault = vi.fn();
    controller.onWheel({
      clientX: 100 + 32,
      clientY: 50 + 16,
      deltaY: 120,
      preventDefault
    });
    expect(preventDefault).toHaveBeenCalled();
    expect(nav.zoomOut).toHaveBeenCalledTimes(1);
    expect(vi.mocked(nav.zoomOut).mock.calls[0][0]).toMatchObject({
      x: 32,
      y: 16
    });

    controller.onWheel({
      clientX: 100,
      clientY: 50,
      deltaY: -120,
      preventDefault
    });
    expect(nav.zoomIn).toHaveBeenCalledTimes(1);
  });

  it('a second finger cancels the tool stream and pans as a gesture', () => {
    controller.onPointerDown(touch(1, 110, 60));
    expect(tool.down).toHaveBeenCalledTimes(1);

    controller.onPointerDown(touch(2, 130, 60));
    expect(tool.cancel).toHaveBeenCalledTimes(1);
    expect(nav.setActive).toHaveBeenCalledWith(true);

    // Centroid moves +10 → gesture pan; the tool stream stays silent.
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
    expect(nav.zoomOut).not.toHaveBeenCalled();
  });

  // A disposed project stays reachable until the host's effect re-homes the
  // controller; its `position`/`scale` are already gone, so mapping a canvas
  // point through it would throw.
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
    expect(nav.zoomIn).not.toHaveBeenCalled();
  });
});
