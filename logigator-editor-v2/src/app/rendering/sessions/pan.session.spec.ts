import { describe, expect, it, vi } from 'vitest';
import { FederatedPointerEvent, Point } from 'pixi.js';
import { PanSession } from './pan.session';
import { Project } from '../../project/project';

/** Minimal pointer-event stub exposing only the screen-space `global` point. */
function makePanEvent(x: number, y: number): FederatedPointerEvent {
  return { global: new Point(x, y) } as unknown as FederatedPointerEvent;
}

describe('PanSession', () => {
  it('pans by the screen-space delta between successive moves', () => {
    const pan = vi.fn();
    const project = { pan } as unknown as Project;
    const session = new PanSession(project, new Point(100, 100));

    session.onMove(makePanEvent(110, 95));
    expect(pan).toHaveBeenCalledTimes(1);
    expect(pan.mock.calls[0][0]).toMatchObject({ x: 10, y: -5 });

    // Delta is relative to the previous move, not the start point.
    session.onMove(makePanEvent(130, 90));
    expect(pan.mock.calls[1][0]).toMatchObject({ x: 20, y: -5 });
  });

  it('does not mutate the start point passed in', () => {
    const start = new Point(50, 50);
    const session = new PanSession(
      { pan: vi.fn() } as unknown as Project,
      start
    );
    session.onMove(makePanEvent(70, 70));
    expect(start).toMatchObject({ x: 50, y: 50 });
  });

  it('always ends; onEnd/onCancel are no-ops', () => {
    const session = new PanSession(
      { pan: vi.fn() } as unknown as Project,
      new Point(0, 0)
    );
    expect(session.canEnd()).toBe(true);
    expect(() => session.onEnd()).not.toThrow();
    expect(() => session.onCancel()).not.toThrow();
  });
});
