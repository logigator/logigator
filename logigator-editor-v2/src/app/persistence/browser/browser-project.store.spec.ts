import { TestBed } from '@angular/core/testing';
import { BrowserProjectStore } from './browser-project.store';

// Karma runs in a real browser, so IndexedDB is available. Each test gets a fresh
// store instance (new TestBed) but shares the origin's database; clear all records
// before each test to isolate. Clearing (vs deleteDatabase) avoids the blocked-delete
// problem when previous test connections are still open.
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('BrowserProjectStore', () => {
	let store: BrowserProjectStore;

	beforeEach(async () => {
		TestBed.configureTestingModule({});
		store = TestBed.inject(BrowserProjectStore);
		const all = await store.list();
		await Promise.all(all.map((p) => store.delete(p.id)));
	});

	it('save() generates an id, stamps timestamps, and is read back by get()', async () => {
		const record = await store.save({ name: 'Alpha', content: '{"v":1}' });

		expect(record.id).toBeTruthy();
		expect(record.name).toBe('Alpha');
		expect(record.createdOn).toBe(record.lastEdited);

		const loaded = await store.get(record.id);
		expect(loaded).toEqual(record);
	});

	it('save() with an existing id updates content, preserves createdOn, advances lastEdited', async () => {
		const first = await store.save({ name: 'Beta', content: 'a' });
		await delay(10);
		const second = await store.save({
			id: first.id,
			name: 'Beta v2',
			content: 'b'
		});

		expect(second.id).toBe(first.id);
		expect(second.name).toBe('Beta v2');
		expect(second.content).toBe('b');
		expect(second.createdOn).toBe(first.createdOn);
		expect(second.lastEdited).toBeGreaterThan(first.lastEdited);

		const all = await store.list();
		expect(all.length).toBe(1);
	});

	it('get() returns undefined for an unknown id', async () => {
		expect(await store.get('does-not-exist')).toBeUndefined();
	});

	it('list() returns summaries (no content) newest-first', async () => {
		const a = await store.save({ name: 'A', content: 'x' });
		await delay(10);
		const b = await store.save({ name: 'B', content: 'y' });

		const list = await store.list();
		expect(list.map((p) => p.id)).toEqual([b.id, a.id]);
		expect(list[0]).toEqual({
			id: b.id,
			name: b.name,
			createdOn: b.createdOn,
			lastEdited: b.lastEdited
		});
		expect('content' in list[0]).toBeFalse();
	});

	it('delete() removes a project', async () => {
		const record = await store.save({ name: 'Gamma', content: 'z' });
		await store.delete(record.id);

		expect(await store.get(record.id)).toBeUndefined();
		expect(await store.list()).toEqual([]);
	});
});
