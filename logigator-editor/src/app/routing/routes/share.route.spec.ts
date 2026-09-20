import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ApiRequestError } from '@logigator/contract';
import { PersistenceService } from '../../persistence/persistence.service';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { LegacyShareRoute, ShareRoute } from './share.route';

const LINK = '11111111-1111-4111-8111-111111111111';

/** A `not_found`, as the API answers for a link that is in no row of a table. */
const NOT_FOUND = new ApiRequestError(404, 'not_found', 'No such document.');

describe('ShareRoute', () => {
  let loadShareAsMain: ReturnType<typeof vi.fn>;
  let replaceState: ReturnType<typeof vi.fn>;

  /**
   * Both routes go through one load, so what they hand it is what these specs
   * are about — and the two spellings of a kind are the point of it: a URL
   * says `projects`, the API's tables say `project`.
   */
  function setup(): void {
    loadShareAsMain = vi.fn().mockResolvedValue({ loaded: true });
    replaceState = vi.fn();

    configureTestBed([
      { provide: PersistenceService, useValue: { loadShareAsMain } },
      { provide: Location, useValue: { replaceState } }
    ]);
  }

  describe('the kind-carrying form', () => {
    it('loads the table its kind segment names', async () => {
      setup();

      const activated = await TestBed.inject(ShareRoute).onActivation({
        kind: 'components',
        linkId: LINK
      });

      expect(activated).toBe(true);
      expect(loadShareAsMain).toHaveBeenCalledWith('component', LINK);
    });

    // `toString` is in the list on purpose: a segment names a table only if the
    // table has that key of its own, and every object has the prototype's.
    it.each(['nonsense', 'toString'])(
      'is not a route when the segment says %s',
      async (kind) => {
        // The pattern matches any segment, so one that names no table has to
        // fall through to the router's own not-found handling rather than
        // loading whatever the mistake happened to select.
        setup();

        const activated = await TestBed.inject(ShareRoute).onActivation({
          kind,
          linkId: LINK
        });

        expect(activated).toBe(false);
        expect(loadShareAsMain).not.toHaveBeenCalled();
      }
    );
  });

  describe('the legacy kind-free form', () => {
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
