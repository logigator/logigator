import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMoveInput } from '../../../testing/factories';
import { DragSession } from '../drag-session';
import { HoldSession } from './hold.session';

function makeHold(): {
  session: DragSession;
  press: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const press = vi.fn();
  const release = vi.fn();
  return { session: new HoldSession(press, release), press, release };
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('HoldSession', () => {
  afterEach(() => {
    // Back to the jsdom default.
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('presses at once and releases when the gesture ends', () => {
    const { session, press, release } = makeHold();
    expect(press).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();

    expect(session.canEnd()).toBe(true);
    session.onEnd();

    expect(release).toHaveBeenCalledTimes(1);
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('releases on cancel', () => {
    const { session, release } = makeHold();

    session.onCancel();

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('stays held however far the pointer moves', () => {
    const { session, release } = makeHold();

    session.onMove(makeMoveInput(40, 40));
    session.onMove(makeMoveInput(-80, 5));

    expect(release).not.toHaveBeenCalled();
  });

  it('releases when the window loses focus, with no pointer-up to wait for', () => {
    const { session, release } = makeHold();

    window.dispatchEvent(new Event('blur'));
    expect(release).toHaveBeenCalledTimes(1);

    // The pointer-up that may still follow releases nothing further.
    session.onEnd();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases when the document is hidden, not when it shows', () => {
    const { release } = makeHold();

    setVisibility('visible');
    expect(release).not.toHaveBeenCalled();

    setVisibility('hidden');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases exactly once, and stops listening once released', () => {
    const { session, release } = makeHold();

    session.onEnd();
    session.onCancel();
    window.dispatchEvent(new Event('blur'));
    setVisibility('hidden');

    expect(release).toHaveBeenCalledTimes(1);
  });
});
