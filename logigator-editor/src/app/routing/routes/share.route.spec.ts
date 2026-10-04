import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ApiRequestError } from '@logigator/contract';
import { PersistenceService } from '../../persistence/persistence.service';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { RouterService } from '../router.service';
import {
  LegacyShareRoute,
  ShareComponentRoute,
  ShareProjectRoute
} from './share.route';

const LINK = '11111111-1111-4111-8111-111111111111';

/** A `not_found`, as the API answers for a link that is in no row of a table. */
const NOT_FOUND = new ApiRequestError(404, 'not_found', 'No such document.');

describe('the share routes', () => {
  let loadShareAsMain: ReturnType<typeof vi.fn>;
  let replaceState: ReturnType<typeof vi.fn>;
  let go: ReturnType<typeof vi.fn>;

  /**
   * The share routes go through one load, so what they hand it is what these
   * specs are about — and the two spellings of a kind are the point of it: a
   * URL says `projects`, the API's tables say `project`.
   */
  function setup(): void {
    loadShareAsMain = vi.fn().mockResolvedValue({ loaded: true });
    replaceState = vi.fn();
    go = vi.fn();

    configureTestBed([
      { provide: PersistenceService, useValue: { loadShareAsMain } },
      { provide: Location, useValue: { replaceState, go } }
    ]);
  }

  describe('the kind-carrying form', () => {
    it('loads the projects table from the project route', async () => {
      setup();

      const activated = await TestBed.inject(ShareProjectRoute).onActivation({
        linkId: LINK
      });

      expect(activated).toBe(true);
      expect(loadShareAsMain).toHaveBeenCalledWith('project', LINK);
    });

    it('loads the components table from the component route', async () => {
      setup();

      const activated = await TestBed.inject(ShareComponentRoute).onActivation({
        linkId: LINK
      });

      expect(activated).toBe(true);
      expect(loadShareAsMain).toHaveBeenCalledWith('component', LINK);
    });

    // Each kind is a literal in the route tree, which is what makes a path
    // naming one a path the router both matches and handles.
    it.each(['projects', 'components'])(
      'matches and activates /share/%s/{link}',
      async (kind) => {
        setup();
        const router = TestBed.inject(RouterService);
        const path = `/share/${kind}/${LINK}`;

        expect(router.matches(path)).toBe(true);
        expect(await router.navigate(path)).toBe(true);
      }
    );

    // The regression this replaced: `/share/:kind/:linkId` matched any word and
    // then declined the ones naming no table, so the path was claimed by a route
    // that handed it back — no other pattern was tried, and the startup's blank
    // draft, created only when *no* pattern matches, never happened. A reader
    // handed `/share/project/{link}` — the API's singular, which the card URL is
    // built from — was left with a toast and nothing in the main slot.
    //
    // `toString` is in the list on purpose: a segment names a kind only if the
    // pattern says so, and the prototype's own keys are what a runtime
    // membership test had to guard against before.
    it.each(['nonsense', 'toString'])(
      'matches nothing at all when the kind segment says %s',
      async (kind) => {
        setup();
        const router = TestBed.inject(RouterService);
        const path = `/share/${kind}/${LINK}`;

        // `matches` is what the startup decides its blank draft on, so a false
        // here is the reader getting a usable editor back.
        expect(router.matches(path)).toBe(false);
        // The same fact from the router's side: nothing handles the path, so
        // the not-found toast and the URL reset are what it answers with.
        expect(await router.navigate(path)).toBe(false);
        expect(loadShareAsMain).not.toHaveBeenCalled();
      }
    );
  });

  describe('the legacy kind-free form', () => {
    it('is still a route, one segment beside the kind-carrying two', () => {
      setup();

      expect(TestBed.inject(RouterService).matches(`/share/${LINK}`)).toBe(
        true
      );
    });

    it('loads a project’s share and upgrades its URL', async () => {
      setup();

      const activated = await TestBed.inject(LegacyShareRoute).onActivation({
        linkId: LINK
      });

      expect(activated).toBe(true);
      expect(loadShareAsMain).toHaveBeenCalledWith('project', LINK, {
        deferNotFound: true
      });
      // Replaced rather than pushed: the legacy URL was never a page of its
      // own, so back should leave the document, not resolve it again.
      expect(replaceState).toHaveBeenCalledWith(`/share/projects/${LINK}`);
    });

    it('falls through to the other table on a not_found', async () => {
      setup();
      loadShareAsMain
        .mockResolvedValueOnce({ loaded: false, error: NOT_FOUND })
        .mockResolvedValueOnce({ loaded: true });

      await TestBed.inject(LegacyShareRoute).onActivation({ linkId: LINK });

      // The fallthrough attempt reports itself: one share load is one failure
      // report, whichever table ends up holding it.
      expect(loadShareAsMain.mock.calls[1]).toEqual(['component', LINK]);
      expect(replaceState).toHaveBeenCalledWith(`/share/components/${LINK}`);
    });

    it('does not fall through when the server failed', async () => {
      // A `5xx` is not an answer about the kind: the other table would fail
      // the same way, and asking it would report the same failure twice.
      setup();
      loadShareAsMain.mockResolvedValueOnce({
        loaded: false,
        error: new ApiRequestError(500, 'internal', 'boom')
      });

      const activated = await TestBed.inject(LegacyShareRoute).onActivation({
        linkId: LINK
      });

      expect(activated).toBe(true);
      expect(loadShareAsMain).toHaveBeenCalledTimes(1);
      expect(replaceState).not.toHaveBeenCalled();
    });

    it('leaves the URL alone when neither table holds the link', async () => {
      setup();
      loadShareAsMain
        .mockResolvedValueOnce({ loaded: false, error: NOT_FOUND })
        .mockResolvedValueOnce({ loaded: false, error: NOT_FOUND });

      await TestBed.inject(LegacyShareRoute).onActivation({ linkId: LINK });

      expect(loadShareAsMain).toHaveBeenCalledTimes(2);
      // Nothing was loaded, so there is no kind to name in the address; the
      // second attempt has already reported the failure.
      expect(replaceState).not.toHaveBeenCalled();
    });
  });
});
