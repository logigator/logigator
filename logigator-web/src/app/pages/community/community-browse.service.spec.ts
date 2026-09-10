import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  type TestRequest
} from '@angular/common/http/testing';
import { communityRow } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { CommunityBrowseService } from './community-browse.service';
import { DEFAULT_ORDER } from './listing-query';

const LINK = '11111111-1111-4111-8111-111111111111';

describe('CommunityBrowseService', () => {
  let http: HttpTestingController;
  let browse: CommunityBrowseService;

  function expectRead(path: string): TestRequest {
    return http.expectOne((request) => request.url === path);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
    browse = TestBed.inject(CommunityBrowseService);
  });

  it('asks the API for exactly what the URL says', async () => {
    const resolved = browse.resolve('components', {
      page: 2,
      search: 'adder',
      orderBy: 'latest'
    });

    const request = expectRead('/api/community/components');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('search')).toBe('adder');
    expect(request.request.params.get('orderBy')).toBe('latest');
    request.flush({ entries: [], page: 2, pageSize: 24, total: 0 });
    await resolved;
  });

  it('sends no filter rather than an empty one', async () => {
    const resolved = browse.resolve('projects', {
      page: 0,
      search: '',
      orderBy: DEFAULT_ORDER
    });

    const request = expectRead('/api/community/projects');
    expect(request.request.params.has('search')).toBe(false);
    request.flush({ entries: [], page: 0, pageSize: 24, total: 0 });
    await resolved;
  });

  it('counts the whole match rather than the page it drew', async () => {
    // The paginator has nothing else to size itself from, and the home page's
    // social proof reads the same field.
    const resolved = browse.resolve('projects', {
      page: 0,
      search: '',
      orderBy: DEFAULT_ORDER
    });
    expectRead('/api/community/projects').flush({
      entries: [communityRow('Half adder', LINK)],
      page: 0,
      pageSize: 24,
      total: 73
    });
    await resolved;

    expect(browse.listing.total()).toBe(73);
    expect(browse.pageCount()).toBe(4);
  });

  it('has no count for a read that failed, and one page to render', async () => {
    const resolved = browse.resolve('projects', {
      page: 0,
      search: '',
      orderBy: DEFAULT_ORDER
    });
    expectRead('/api/community/projects').flush(
      { code: 'service_unavailable', message: 'Postgres is unreachable.' },
      { status: 503, statusText: 'Service Unavailable' }
    );
    await resolved;

    expect(browse.listing.entries()).toBeNull();
    expect(browse.listing.total()).toBeNull();
    // Not zero pages: the control would otherwise size itself off a failure.
    expect(browse.pageCount()).toBe(1);
  });
});
