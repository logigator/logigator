import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { communityRow } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { CommunityDocumentService } from './community-document.service';

const LINK = '11111111-1111-4111-8111-111111111111';
const DETAIL_URL = `/api/community/projects/${LINK}`;

function detail(patch = {}) {
  return { ...communityRow('Half adder', LINK, patch), forkedFrom: null };
}

describe('CommunityDocumentService', () => {
  let http: HttpTestingController;
  let content: CommunityDocumentService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
    content = TestBed.inject(CommunityDocumentService);
  });

  it('treats a link naming nothing published as the page’s own 404', async () => {
    // Regenerating a share token leaves exactly this URL behind, so it is a
    // real 404 rather than a section that failed — and a soft 404 stays
    // indexed.
    const resolved = content.resolve('projects', LINK);
    http
      .expectOne(DETAIL_URL)
      .flush(
        { code: 'not_found', message: 'No such published document.' },
        { status: 404, statusText: 'Not Found' }
      );
    await resolved;

    expect(content.missing()).toBe(true);
    expect(content.failureKey()).toBeNull();
  });

  it('keeps the page with a retry for a failure that is not a 404', async () => {
    const resolved = content.resolve('projects', LINK);
    http
      .expectOne(DETAIL_URL)
      .flush(
        { code: 'service_unavailable', message: 'Postgres is unreachable.' },
        { status: 503, statusText: 'Service Unavailable' }
      );
    await resolved;

    expect(content.missing()).toBe(false);
    expect(content.failureKey()).toBe('forms.errors.serviceUnavailable');

    const retried = content.retry();
    http.expectOne(DETAIL_URL).flush(detail());
    await retried;
    expect(content.document()?.name).toBe('Half adder');
  });

  it('takes the star tally from the response rather than counting locally', async () => {
    // Another reader's star between two clicks would leave a locally
    // incremented tally one out, and `PUT` answers the count it produced.
    const resolved = content.resolve('projects', LINK);
    http.expectOne(DETAIL_URL).flush(detail({ stars: 12, starred: false }));
    await resolved;
    expect(content.stars()).toBe(12);

    const starred = content.setStar(true);
    const request = http.expectOne(`${DETAIL_URL}/star`);
    expect(request.request.method).toBe('PUT');
    request.flush({ starred: true, stars: 20 });
    await starred;

    expect(content.starred()).toBe(true);
    expect(content.stars()).toBe(20);
  });

  it('states the star it wants rather than toggling', async () => {
    const resolved = content.resolve('projects', LINK);
    http.expectOne(DETAIL_URL).flush(detail({ stars: 5, starred: true }));
    await resolved;

    const unstarred = content.setStar(false);
    const request = http.expectOne(`${DETAIL_URL}/star`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ starred: false, stars: 4 });
    await unstarred;

    expect(content.starred()).toBe(false);
    expect(content.stars()).toBe(4);
  });

  it('leaves the resolved tally standing when the star could not be set', async () => {
    const resolved = content.resolve('projects', LINK);
    http.expectOne(DETAIL_URL).flush(detail({ stars: 12, starred: false }));
    await resolved;

    const attempted = content.setStar(true);
    http
      .expectOne(`${DETAIL_URL}/star`)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await attempted;

    expect(content.starred()).toBe(false);
    expect(content.stars()).toBe(12);
    expect(content.actionFailureKey()).toBe('forms.errors.unknown');
  });
});
