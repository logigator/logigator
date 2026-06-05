import { TestBed } from '@angular/core/testing';
import { BrowserComponentStore } from './browser-component.store';

// Karma runs in a real browser, so IndexedDB is available. Clear all records
// before each test to isolate (the origin's database is shared across tests).
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const base = {
  version: 1,
  symbol: 'C',
  description: '',
  numInputs: 1,
  numOutputs: 1,
  labels: ['a', 'q'],
  content: '{"v":2}'
};

describe('BrowserComponentStore', () => {
  let store: BrowserComponentStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(BrowserComponentStore);
    const all = await store.list();
    await Promise.all(all.map((c) => store.delete(c.id)));
  });

  it('save() generates an id, stamps timestamps, and is read back by get()', async () => {
    const record = await store.save({ ...base, name: 'Alpha' });

    expect(record.id).toBeTruthy();
    expect(record.name).toBe('Alpha');
    expect(record.numInputs).toBe(1);
    expect(record.labels).toEqual(['a', 'q']);
    expect(record.createdOn).toBe(record.lastEdited);

    expect(await store.get(record.id)).toEqual(record);
  });

  it('save() with an existing id preserves createdOn and advances lastEdited', async () => {
    const first = await store.save({ ...base, name: 'Beta' });
    await delay(10);
    const second = await store.save({
      ...base,
      id: first.id,
      name: 'Beta v2',
      version: 2
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Beta v2');
    expect(second.version).toBe(2);
    expect(second.createdOn).toBe(first.createdOn);
    expect(second.lastEdited).toBeGreaterThan(first.lastEdited);
    expect((await store.list()).length).toBe(1);
  });

  it('list() returns summaries (no content) newest-first', async () => {
    const a = await store.save({ ...base, name: 'A' });
    await delay(10);
    const b = await store.save({ ...base, name: 'B' });

    const list = await store.list();
    expect(list.map((c) => c.id)).toEqual([b.id, a.id]);
    expect('content' in list[0]).toBeFalse();
    expect(list[0].numInputs).toBe(1);
  });

  it('delete() removes a master', async () => {
    const record = await store.save({ ...base, name: 'Gamma' });
    await store.delete(record.id);

    expect(await store.get(record.id)).toBeUndefined();
    expect(await store.list()).toEqual([]);
  });
});
