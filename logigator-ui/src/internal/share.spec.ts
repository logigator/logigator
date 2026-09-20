import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canShare,
  copyText,
  documentPath,
  SHARE_CARD_PATH_PATTERN,
  shareCardUrl,
  shareOrCopy
} from './share';

const TOKEN = '2b0b6f0e-0000-4000-8000-000000000000';
const LINK = `https://logigator.com/de/community/projects/${TOKEN}`;

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

describe('the two URLs a document is handed out as', () => {
  it('names the document by its kind in both, each in its own spelling', () => {
    // The two vocabularies are the point: the API names the table a row lives
    // in, the route names the section its page lives in. A single builder
    // spelling both the same way is the mistake this pair exists to prevent.
    expect(documentPath('projects', TOKEN)).toBe(
      `/community/projects/${TOKEN}`
    );
    expect(shareCardUrl('project', TOKEN)).toBe(
      `/api/share/project/${TOKEN}/card.png`
    );

    expect(documentPath('components', TOKEN)).toBe(
      `/community/components/${TOKEN}`
    );
    expect(shareCardUrl('component', TOKEN)).toBe(
      `/api/share/component/${TOKEN}/card.png`
    );
  });

  it('spells the card route as an access rule too', () => {
    // `robots.txt` needs one line where the route has a kind and a token, and
    // it is built from the same template so that a card the site stops
    // serving cannot leave the rule behind naming it — a mismatch nothing
    // fails on, and nobody sees until a pasted link unfurls blank.
    expect(SHARE_CARD_PATH_PATTERN).toBe('/api/share/*/*/card.png');
  });
});
