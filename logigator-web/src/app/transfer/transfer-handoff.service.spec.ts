import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  makeStateKey,
  PLATFORM_ID,
  provideZonelessChangeDetection,
  TransferState
} from '@angular/core';
import { TransferHandoffService } from './transfer-handoff.service';

const KEY = makeStateKey<string | null>('spec.handoff');

function configure(platform: 'browser' | 'server'): TransferHandoffService {
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: PLATFORM_ID, useValue: platform }
    ]
  });
  return TestBed.inject(TransferHandoffService);
}

describe('TransferHandoffService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('hands a transferred value over without asking the source', async () => {
    const handoff = configure('browser');
    TestBed.inject(TransferState).set(KEY, 'from the render');
    const fetch = vi.fn();

    await expect(handoff.resolve(KEY, fetch)).resolves.toBe('from the render');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('consumes the hand-off, so resolving again asks the source', async () => {
    const handoff = configure('browser');
    TestBed.inject(TransferState).set(KEY, 'from the render');
    await handoff.resolve(KEY, () => Promise.resolve('unread'));

    await expect(
      handoff.resolve(KEY, () => Promise.resolve('fresh'))
    ).resolves.toBe('fresh');
  });

  it('stores what a server render fetches for the browser to pick up', async () => {
    const handoff = configure('server');

    await handoff.resolve(KEY, () => Promise.resolve('rendered'));

    expect(TestBed.inject(TransferState).get(KEY, null)).toBe('rendered');
  });

  it('keeps the hand-off intact when a server render resolves twice', async () => {
    // Consuming on the server would unpublish the value before the document
    // serializes, making the browser repeat the request after hydration.
    const handoff = configure('server');
    await handoff.resolve(KEY, () => Promise.resolve('rendered'));

    await expect(
      handoff.resolve(KEY, () => Promise.resolve('unread'))
    ).resolves.toBe('rendered');
    expect(TestBed.inject(TransferState).hasKey(KEY)).toBe(true);
  });

  it('stores nothing in the browser', async () => {
    // The browser is the end of the line: a value written here would never be
    // consumed and would leak into the next resolve of the same key.
    const handoff = configure('browser');

    await handoff.resolve(KEY, () => Promise.resolve('fetched'));

    expect(TestBed.inject(TransferState).hasKey(KEY)).toBe(false);
  });

  it('transfers nothing when the fetch rejects', async () => {
    // An error cannot cross the boundary as a value; the browser repeats the
    // request instead of hydrating from a failure.
    const handoff = configure('server');

    await expect(
      handoff.resolve(KEY, () => Promise.reject(new Error('api down')))
    ).rejects.toThrow('api down');
    expect(TestBed.inject(TransferState).hasKey(KEY)).toBe(false);
  });
});
