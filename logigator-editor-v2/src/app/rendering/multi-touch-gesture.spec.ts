import { describe, expect, it, vi } from 'vitest';
import { GestureTarget, MultiTouchGesture } from './multi-touch-gesture';

function makeTarget() {
  return {
    pan: vi.fn(),
    zoomBy: vi.fn(),
    abortActiveDrag: vi.fn(),
    setActive: vi.fn()
  } satisfies GestureTarget;
}

describe('MultiTouchGesture', () => {
  it('stays inert with a single pointer', () => {
    const target = makeTarget();
    const g = new MultiTouchGesture(target);

    g.onPointerDown(1, 0, 0);
    g.onPointerMove(1, 50, 50);

    expect(g.isActive).toBe(false);
    expect(target.abortActiveDrag).not.toHaveBeenCalled();
    expect(target.setActive).not.toHaveBeenCalled();
    expect(target.pan).not.toHaveBeenCalled();
  });

  it('aborts the active drag and activates when a second finger lands', () => {
    const target = makeTarget();
    const g = new MultiTouchGesture(target);

    g.onPointerDown(1, 0, 0);
    g.onPointerDown(2, 10, 0);

    expect(g.isActive).toBe(true);
    expect(target.abortActiveDrag).toHaveBeenCalledTimes(1);
    expect(target.setActive).toHaveBeenCalledWith(true);
  });

  it('pans by the centroid delta and zooms by the spread ratio', () => {
    const target = makeTarget();
    const g = new MultiTouchGesture(target);

    g.onPointerDown(1, 0, 0);
    g.onPointerDown(2, 10, 0); // centroid (5,0), spread 5

    g.onPointerMove(1, 2, 0); // pointers (2,0),(10,0): centroid (6,0), spread 4

    expect(target.pan).toHaveBeenCalledTimes(1);
    expect(target.pan.mock.calls[0][0]).toMatchObject({ x: 1, y: 0 });
    expect(target.zoomBy).toHaveBeenCalledTimes(1);
    const [factor, center] = target.zoomBy.mock.calls[0];
    expect(factor).toBeCloseTo(0.8);
    expect(center).toMatchObject({ x: 6, y: 0 });
  });

  it('zooms in when the fingers spread apart', () => {
    const target = makeTarget();
    const g = new MultiTouchGesture(target);

    g.onPointerDown(1, 0, 0);
    g.onPointerDown(2, 10, 0); // spread 5
    g.onPointerMove(2, 20, 0); // pointers (0,0),(20,0): spread 10

    const [factor] = target.zoomBy.mock.calls[0];
    expect(factor).toBeCloseTo(2);
  });

  it('ends the gesture and does not pan once below two pointers', () => {
    const target = makeTarget();
    const g = new MultiTouchGesture(target);

    g.onPointerDown(1, 0, 0);
    g.onPointerDown(2, 10, 0);
    g.onPointerUp(2);

    expect(g.isActive).toBe(false);
    expect(target.setActive).toHaveBeenLastCalledWith(false);

    target.pan.mockClear();
    g.onPointerMove(1, 99, 99);
    expect(target.pan).not.toHaveBeenCalled();
  });

  it('rebases without panning when dropping from three to two pointers', () => {
    const target = makeTarget();
    const g = new MultiTouchGesture(target);

    g.onPointerDown(1, 0, 0);
    g.onPointerDown(2, 10, 0);
    g.onPointerDown(3, 5, 10);
    target.pan.mockClear();
    target.setActive.mockClear();

    g.onPointerUp(3); // still two pointers → no deactivation, no jump

    expect(g.isActive).toBe(true);
    expect(target.setActive).not.toHaveBeenCalled();
    // Next move pans relative to the rebased centroid, not the 3-finger one.
    g.onPointerMove(1, 1, 0);
    expect(target.pan).toHaveBeenCalledTimes(1);
  });
});
