import { describe, expect, it, vi } from 'vitest';
import { FederatedPointerEvent, Point } from 'pixi.js';
import { PanSession } from './pan.session';
import { Project } from '../../project/project';
import { WorkMode } from '../../work-mode/work-mode.enum';

/** Minimal pointer-event stub exposing only the screen-space `global` point. */
function makePanEvent(x: number, y: number): FederatedPointerEvent {
  return { global: new Point(x, y) } as unknown as FederatedPointerEvent;
}

function makeProject() {
  return {
    pan: vi.fn(),
    selectionManager: { commit: vi.fn() }
  } as unknown as Project & {
    selectionManager: { commit: ReturnType<typeof vi.fn> };
  };
}

describe('PanSession', () => {
  it('pans by the screen-space delta between successive moves', () => {
    const project = makeProject();
    const session = new PanSession(
      project,
      new Point(100, 100),
      new Point(0, 0)
    );

    session.onMove(makePanEvent(110, 95));
    expect(project.pan).toHaveBeenCalledTimes(1);
    // First pan delta is measured from the press point (the dead zone catches up).
    expect(
      (project.pan as ReturnType<typeof vi.fn>).mock.calls[0][0]
    ).toMatchObject({
      x: 10,
      y: -5
    });

    session.onMove(makePanEvent(130, 90));
    expect(
      (project.pan as ReturnType<typeof vi.fn>).mock.calls[1][0]
    ).toMatchObject({
      x: 20,
      y: -5
    });
  });

  it('does not pan or mutate the start point within the tap threshold', () => {
    const start = new Point(50, 50);
    const project = makeProject();
    const session = new PanSession(project, start, new Point(0, 0));

    session.onMove(makePanEvent(52, 51)); // ~2px — under threshold
    expect(project.pan).not.toHaveBeenCalled();
    expect(start).toMatchObject({ x: 50, y: 50 });
  });

  it('single-selects under the click point on a tap (no movement)', () => {
    const project = makeProject();
    const session = new PanSession(
      project,
      new Point(100, 100),
      new Point(3, 4)
    );

    session.onEnd();

    expect(project.selectionManager.commit).toHaveBeenCalledTimes(1);
    const [rect, mode] = project.selectionManager.commit.mock.calls[0];
    expect(rect).toMatchObject({ x: 3, y: 4, width: 0, height: 0 });
    expect(mode).toBe(WorkMode.SELECT);
  });

  it('does not select after a pan (moved past the threshold)', () => {
    const project = makeProject();
    const session = new PanSession(
      project,
      new Point(100, 100),
      new Point(3, 4)
    );

    session.onMove(makePanEvent(140, 100)); // 40px — a clear pan
    session.onEnd();

    expect(project.selectionManager.commit).not.toHaveBeenCalled();
  });

  it('invokes onTap instead of selecting on a tap when provided', () => {
    const project = makeProject();
    const onTap = vi.fn();
    const session = new PanSession(
      project,
      new Point(100, 100),
      new Point(3, 4),
      onTap
    );

    session.onEnd();

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap.mock.calls[0][0]).toMatchObject({ x: 3, y: 4 });
    expect(project.selectionManager.commit).not.toHaveBeenCalled();
  });

  it('does not invoke onTap after a pan', () => {
    const project = makeProject();
    const onTap = vi.fn();
    const session = new PanSession(
      project,
      new Point(100, 100),
      new Point(3, 4),
      onTap
    );

    session.onMove(makePanEvent(140, 100)); // 40px — a clear pan
    session.onEnd();

    expect(onTap).not.toHaveBeenCalled();
  });

  it('does not select on cancel; canEnd is always true', () => {
    const project = makeProject();
    const session = new PanSession(project, new Point(0, 0), new Point(1, 1));
    expect(session.canEnd()).toBe(true);
    expect(() => session.onCancel()).not.toThrow();
    expect(project.selectionManager.commit).not.toHaveBeenCalled();
  });
});
