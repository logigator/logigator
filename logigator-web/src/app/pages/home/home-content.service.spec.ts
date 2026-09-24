import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  type TestRequest
} from '@angular/common/http/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { EMPTY_PAGE } from '../../../testing/community-rows';
import { environment } from '../../../environments/environment';
import { HomeContentService } from './home-content.service';

/** The API's own error body, which is where the mapped code comes from. */
const UNAVAILABLE = {
  body: { code: 'service_unavailable', message: 'Redis is unreachable.' },
  init: { status: 503, statusText: 'Service Unavailable' }
};

const EXAMPLES_URL = `/api/community/users/${environment.exampleUserId}/projects`;

describe('HomeContentService', () => {
  let http: HttpTestingController;
  let content: HomeContentService;

  /** Matches on the path alone; the query is what each read differs by. */
  function expectRead(path: string): TestRequest {
    return http.expectOne((request) => request.url === path);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
    content = TestBed.inject(HomeContentService);
  });

  it('reads the examples from the configured account, not a literal', async () => {
    const resolved = content.resolve();

    const request = expectRead(EXAMPLES_URL);
    expect(request.request.params.get('size')).toBe('6');

    request.flush(EMPTY_PAGE);
    expectRead('/api/community/projects').flush(EMPTY_PAGE);
    expectRead('/api/community/components').flush(EMPTY_PAGE);
    await resolved;
  });

  it('ranks the two community listings by stars', async () => {
    const resolved = content.resolve();

    expectRead(EXAMPLES_URL).flush(EMPTY_PAGE);
    const projects = expectRead('/api/community/projects');
    expect(projects.request.params.get('orderBy')).toBe('stars');
    expect(projects.request.params.get('size')).toBe('4');
    projects.flush(EMPTY_PAGE);
    expectRead('/api/community/components').flush(EMPTY_PAGE);
    await resolved;
  });

  it('keeps an empty list apart from a read that failed', async () => {
    const resolved = content.resolve();

    expectRead(EXAMPLES_URL).flush(EMPTY_PAGE);
    expectRead('/api/community/projects').flush(EMPTY_PAGE);
    expectRead('/api/community/components').flush(
      UNAVAILABLE.body,
      UNAVAILABLE.init
    );
    await resolved;

    // An empty list is a working API with nothing published; the section says
    // so with an empty state, and only the failed one offers a retry.
    expect(content.projects.entries()).toEqual([]);
    expect(content.projects.failureKey()).toBeNull();
    expect(content.components.entries()).toBeNull();
    expect(content.components.failureKey()).toBe(
      'forms.errors.serviceUnavailable'
    );
  });

  it('resolves a failed read to a value rather than rejecting', async () => {
    // A rejected read transfers nothing, so a server render's failure would
    // reach the browser as an empty hand-off and hydration would repeat the
    // same doomed request. Resolving is what carries it across.
    const resolved = content.resolve();

    expectRead(EXAMPLES_URL).flush(null, {
      status: 500,
      statusText: 'Server Error'
    });
    expectRead('/api/community/projects').flush(EMPTY_PAGE);
    expectRead('/api/community/components').flush(EMPTY_PAGE);

    await expect(resolved).resolves.toBeUndefined();
    expect(content.examples.failureKey()).toBe('forms.errors.unknown');
  });

  it('asks again on a retry rather than replaying the answer that failed', async () => {
    const resolved = content.resolve();
    expectRead(EXAMPLES_URL).flush(EMPTY_PAGE);
    expectRead('/api/community/projects').flush(null, {
      status: 500,
      statusText: 'Server Error'
    });
    expectRead('/api/community/components').flush(EMPTY_PAGE);
    await resolved;

    const retried = content.projects.retry();
    expectRead('/api/community/projects').flush(EMPTY_PAGE);
    await retried;

    expect(content.projects.failureKey()).toBeNull();
    expect(content.projects.entries()).toEqual([]);
  });
});
