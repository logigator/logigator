import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeLgix, hasLgixMagic, InvalidFileError } from '@logigator/core';
import { BrowserProjectStore } from './browser-project.store';
import { PersistedBrowserProject } from './browser-project.types';
import { IndexedDbStore } from '../../storage/indexed-db-store';

// A document is opaque to the store: it only frames and unframes the string.
const DOCUMENT = JSON.stringify({
  version: 1,
  name: 'Board',
  components: [{ type: 0, pos: [0, 0], options: {} }],
  wires: ['0,0:e4']
});

/**
 * In-memory stand-in for the IndexedDB object store, installed on the
 * prototype so everything above it is the real store. Records are copied in and
 * out, so a spec inspects what was persisted rather than an object the store
 * still holds a reference to.
 */
function installFakeDb(): Map<string, PersistedBrowserProject> {
  const records = new Map<string, PersistedBrowserProject>();
  vi.spyOn(IndexedDbStore.prototype, 'get').mockImplementation(
    async (id: string) => {
      const record = records.get(id);
      return record && { ...record };
    }
  );
  vi.spyOn(IndexedDbStore.prototype, 'put').mockImplementation(
    async (record) => {
      records.set(record.id, { ...record } as PersistedBrowserProject);
    }
  );
  return records;
}

describe('BrowserProjectStore', () => {
  let store: BrowserProjectStore;
  let records: Map<string, PersistedBrowserProject>;

  beforeEach(() => {
    records = installFakeDb();
    store = new BrowserProjectStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips a document while persisting it as .lgix bytes', async () => {
    const saved = await store.save({ name: 'Board', content: DOCUMENT });

    const persisted = records.get(saved.id)!;
    expect(persisted.content).toBeInstanceOf(Uint8Array);
    expect(hasLgixMagic(persisted.content as Uint8Array)).toBe(true);

    const loaded = await store.get(saved.id);
    expect(loaded?.content).toBe(DOCUMENT);
  });

  it('reads a pre-compression string record and re-encodes it on the next save', async () => {
    records.set('legacy', {
      id: 'legacy',
      name: 'Old',
      createdOn: 111,
      lastEdited: 222,
      content: DOCUMENT
    });

    const loaded = await store.get('legacy');
    expect(loaded?.content).toBe(DOCUMENT);

    await store.save({ id: 'legacy', name: 'Old', content: DOCUMENT });

    const persisted = records.get('legacy')!;
    expect(persisted.content).toBeInstanceOf(Uint8Array);
    expect(hasLgixMagic(persisted.content as Uint8Array)).toBe(true);
    // The re-encode is a normal save, so it still carries the original
    // creation time over from the record it replaced.
    expect(persisted.createdOn).toBe(111);
  });

  it('rejects a corrupted container instead of yielding an empty circuit', async () => {
    const bytes = await encodeLgix(DOCUMENT);
    // gzip's CRC32/ISIZE trailer is what makes truncation and bit rot
    // detectable at all.
    bytes[bytes.length - 1] ^= 0xff;
    records.set('corrupt', {
      id: 'corrupt',
      name: 'Board',
      createdOn: 1,
      lastEdited: 1,
      content: bytes
    });

    await expect(store.get('corrupt')).rejects.toBeInstanceOf(InvalidFileError);
  });
});
