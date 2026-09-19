import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import {
  shareComponentResponse,
  shareProjectResponse
} from '../../../testing/share-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { ShareLandingService } from './share-landing.service';

const LINK = '11111111-1111-4111-8111-111111111111';
const SHARE_URL = `/api/share/${LINK}`;

describe('ShareLandingService', () => {
  let http: HttpTestingController;
  let service: ShareLandingService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ShareLandingService);
  });

  it('reads the document a token addresses', async () => {
    const resolved = service.resolve(LINK);
    http.expectOne(SHARE_URL).flush(shareProjectResponse(LINK));
    await resolved;

    expect(service.share()?.author.username).toBe('marek_h');
    expect(service.summary()?.name).toBe('Half adder');
    expect(service.missing()).toBe(false);
    expect(service.failureKey()).toBeNull();
  });

  it('spells the kind the way this site’s routes do', async () => {
    // The API says `component` and the routes say `components`. Handing the
    // API's spelling to a link builder produces a URL that 404s, and the page
    // that built it has no way to notice.
    const component = service.resolve(LINK);
    http.expectOne(SHARE_URL).flush(shareComponentResponse(LINK));
    await component;
    expect(service.kind()).toBe('components');

    const project = service.resolve(LINK);
    http.expectOne(SHARE_URL).flush(shareProjectResponse(LINK));
    await project;
    expect(service.kind()).toBe('projects');
  });

  it('treats a token that was regenerated as missing, not as a failure', async () => {
    const resolved = service.resolve(LINK);
    http
      .expectOne(SHARE_URL)
      .flush(
        { code: 'not_found', message: 'No such share link.' },
        { status: 404, statusText: 'Not Found' }
      );
    await resolved;

    expect(service.missing()).toBe(true);
    expect(service.failureKey()).toBeNull();
  });

  it('keeps the page and offers a retry when the read fails', async () => {
    const failed = service.resolve(LINK);
    http
      .expectOne(SHARE_URL)
      .flush(
        { code: 'service_unavailable', message: 'down' },
        { status: 503, statusText: 'Service Unavailable' }
      );
    await failed;

    expect(service.missing()).toBe(false);
    expect(service.failureKey()).toBe('forms.errors.serviceUnavailable');

    // The retry asks again rather than replaying the answer that failed.
    const retried = service.retry();
    http.expectOne(SHARE_URL).flush(shareProjectResponse(LINK));
    await retried;

    expect(service.failureKey()).toBeNull();
    expect(service.share()).not.toBeNull();
  });
});
