import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  type TestRequest
} from '@angular/common/http/testing';
import type { ProjectSummary } from '@logigator/contract';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { MyDocumentsService } from './my-documents.service';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

function row(id: string, name: string): ProjectSummary {
  return {
    id,
    name,
    description: '',
    visibility: 'unlisted',
    link: id,
    version: 1,
    componentCount: 0,
    wireCount: 0,
    preview: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastEditedAt: '2026-01-01T00:00:00.000Z'
  };
}

describe('MyDocumentsService', () => {
  let http: HttpTestingController;
  let documents: MyDocumentsService;

  function expectRead(path: string): TestRequest {
    return http.expectOne((request) => request.url === path);
  }

  async function resolveWith(
    entries: ProjectSummary[],
    total = entries.length
  ) {
    const resolved = documents.resolve('projects', { page: 0, search: '' });
    expectRead('/api/projects').flush({
      entries,
      page: 0,
      pageSize: 24,
      total
    });
    await resolved;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
    documents = TestBed.inject(MyDocumentsService);
  });

  it('asks the API for exactly what the URL says', async () => {
    const resolved = documents.resolve('components', {
      page: 2,
      search: 'adder'
    });

    const request = expectRead('/api/components');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('search')).toBe('adder');
    request.flush({ entries: [], page: 2, pageSize: 24, total: 0 });
    await resolved;
  });

  it('sends no filter rather than an empty one', async () => {
    const resolved = documents.resolve('projects', { page: 0, search: '' });

    const request = expectRead('/api/projects');
    expect(request.request.params.has('search')).toBe(false);
    request.flush({ entries: [], page: 0, pageSize: 24, total: 0 });
    await resolved;
  });

  it('shows what a metadata write answered rather than re-reading the page', async () => {
    await resolveWith([row(ID_A, 'Half adder'), row(ID_B, 'Latch')]);

    documents.applyPatch(ID_A, { name: 'Full adder', visibility: 'public' });

    expect(documents.rows()?.map((entry) => entry.name)).toEqual([
      'Full adder',
      'Latch'
    ]);
    expect(documents.rows()?.[0]?.visibility).toBe('public');
    // A re-read would also re-sort the grid: a rename bumps the edit time.
    http.verify();
  });

  it('takes a deleted row off the grid and off the count', async () => {
    await resolveWith([row(ID_A, 'Half adder'), row(ID_B, 'Latch')], 30);

    documents.dropRow(ID_A);

    expect(documents.rows()?.map((entry) => entry.id)).toEqual([ID_B]);
    expect(documents.total()).toBe(29);
    expect(documents.pageCount()).toBe(2);
  });

  it('leads the grid with a created row and counts it, a page staying a page', async () => {
    const full = Array.from({ length: 24 }, (_, index) =>
      row(
        `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        `R${index}`
      )
    );
    await resolveWith(full, 30);
    const last = full[23]!.id;

    documents.addRow(row(ID_A, 'Half adder'));

    const rows = documents.rows()!;
    expect(rows[0]?.id).toBe(ID_A);
    expect(rows).toHaveLength(24);
    expect(rows.some((entry) => entry.id === last)).toBe(false);
    expect(documents.total()).toBe(31);

    // Deleting one brings back the tile the create pushed off.
    documents.dropRow(ID_A);
    expect(documents.rows()?.at(-1)?.id).toBe(last);
    expect(documents.total()).toBe(30);
  });

  it('drops the edits it made once the page is resolved again', async () => {
    await resolveWith([row(ID_A, 'Half adder')]);
    documents.applyPatch(ID_A, { name: 'Full adder' });
    documents.dropRow(ID_A);
    documents.addRow(row(ID_B, 'Latch'));

    await resolveWith([row(ID_A, 'Half adder')]);

    expect(documents.rows()?.map((entry) => entry.name)).toEqual([
      'Half adder'
    ]);
    expect(documents.total()).toBe(1);
  });
});
