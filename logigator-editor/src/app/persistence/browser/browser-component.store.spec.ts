import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasLgixMagic } from '@logigator/core';
import { BrowserComponentStore } from './browser-component.store';
import { PersistedBrowserComponent } from './browser-project.types';
import { IndexedDbStore } from '../../storage/indexed-db-store';

// A document is opaque to the store: it only frames and unframes the string.
const DOCUMENT = JSON.stringify({
  version: 1,
  name: 'Adder',
  components: [{ type: 0, pos: [0, 0], options: {} }],
  wires: ['0,0:e4']
});

/** See the note on the twin in `browser-project.store.spec.ts`. */
function installFakeDb(): Map<string, PersistedBrowserComponent> {
  const records = new Map<string, PersistedBrowserComponent>();
  vi.spyOn(IndexedDbStore.prototype, 'get').mockImplementation(
    async (id: string) => {
      const record = records.get(id);
      return record && { ...record };
    }
  );
  vi.spyOn(IndexedDbStore.prototype, 'put').mockImplementation(
    async (record) => {
      records.set(record.id, { ...record } as PersistedBrowserComponent);
    }
  );
  return records;
}

function legacyRecord(): PersistedBrowserComponent {
  return {
    id: 'legacy',
    version: 3,
    name: 'Old',
    symbol: 'O',
    description: 'was here first',
    numInputs: 2,
    numOutputs: 1,
    labels: ['a', 'b', 'y'],
    createdOn: 111,
    lastEdited: 222,
    content: DOCUMENT
  };
}

describe('BrowserComponentStore', () => {
  let store: BrowserComponentStore;
  let records: Map<string, PersistedBrowserComponent>;

  beforeEach(() => {
    records = installFakeDb();
    store = new BrowserComponentStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips a master while persisting it as .lgix bytes', async () => {
    const saved = await store.save({
      version: 1,
      name: 'Adder',
      symbol: 'AD',
      description: '',
      numInputs: 2,
      numOutputs: 1,
      labels: ['a', 'b', 'y'],
      content: DOCUMENT
    });

    const persisted = records.get(saved.id)!;
    expect(persisted.content).toBeInstanceOf(Uint8Array);
    expect(hasLgixMagic(persisted.content as Uint8Array)).toBe(true);

    const loaded = await store.get(saved.id);
    expect(loaded?.content).toBe(DOCUMENT);
  });

  it('leaves a pre-compression record’s circuit byte-identical through updateDetails', async () => {
    records.set('legacy', legacyRecord());

    const summary = await store.updateDetails('legacy', {
      name: 'New',
      symbol: 'N',
      description: 'renamed'
    });
    expect(summary.version).toBe(4);

    // The patch touches descriptive columns only: it must neither decode and
    // re-encode the circuit nor rewrite a record whose content it never read.
    expect(records.get('legacy')!.content).toBe(DOCUMENT);

    const loaded = await store.get('legacy');
    expect(loaded?.content).toBe(DOCUMENT);
    expect(loaded?.name).toBe('New');
  });
});
