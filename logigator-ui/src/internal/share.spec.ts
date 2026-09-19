import { afterEach, describe, expect, it, vi } from 'vitest';
import { canShare, copyText, shareOrCopy } from './share';

const LINK =
  'https://logigator.com/de/share/2b0b6f0e-0000-4000-8000-000000000000';

/** Puts a member on the real `navigator`, removed again after every test. */
function install(key: 'share' | 'clipboard', value: unknown): void {
  Object.defineProperty(navigator, key, { configurable: true, value });
}

function clipboard(): { writeText: ReturnType<typeof vi.fn> } {
  const stub = { writeText: vi.fn().mockResolvedValue(undefined) };
  install('clipboard', stub);
  return stub;
}

describe('shareOrCopy', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('answers false where the browser has no sheet', () => {
    expect(canShare()).toBe(false);
  });

  it('writes the link where there is no sheet to open', async () => {
    const stub = clipboard();

    install('share', undefined);

    await expect(shareOrCopy({ title: 'Full adder', url: LINK })).resolves.toBe(
      'copied'
    );
    expect(stub.writeText).toHaveBeenCalledWith(LINK);
  });

  it('prefers the sheet to the clipboard where there is one', async () => {
    const stub = clipboard();
    const share = vi.fn().mockResolvedValue(undefined);
    install('share', share);

    expect(canShare()).toBe(true);
    await expect(shareOrCopy({ title: 'Full adder', url: LINK })).resolves.toBe(
      'shared'
    );
    expect(share).toHaveBeenCalledWith({ title: 'Full adder', url: LINK });
    expect(stub.writeText).not.toHaveBeenCalled();
  });

  it('reads a dismissal off the name alone, and copies nothing', async () => {
    // A user closing the sheet must not read as a failure *and* must not fall
    // through to the clipboard, or the link is copied behind their back. The
    // rejection is a bare object on purpose: the check cannot lean on
    // `instanceof DOMException`.
    const stub = clipboard();
    install(
      'share',
      vi.fn().mockRejectedValue({ name: 'AbortError', message: 'cancelled' })
    );

    await expect(shareOrCopy({ title: 'Full adder', url: LINK })).resolves.toBe(
      'dismissed'
    );
    expect(stub.writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard for a sheet that refuses', async () => {
    const stub = clipboard();
    install(
      'share',
      vi.fn().mockRejectedValue(new Error('not allowed by permissions policy'))
    );

    await expect(shareOrCopy({ title: 'Full adder', url: LINK })).resolves.toBe(
      'copied'
    );
    expect(stub.writeText).toHaveBeenCalledWith(LINK);
  });

  it('answers failed rather than throwing when the clipboard refuses', async () => {
    install('clipboard', {
      writeText: vi.fn().mockRejectedValue(new Error('denied'))
    });

    await expect(shareOrCopy({ title: 'Full adder', url: LINK })).resolves.toBe(
      'failed'
    );
  });
});

describe('copyText', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('is a boolean, because a refusal is ordinary rather than exceptional', async () => {
    install('clipboard', {
      writeText: vi.fn().mockRejectedValue(new Error('denied'))
    });

    await expect(copyText('anything')).resolves.toBe(false);
  });
});
