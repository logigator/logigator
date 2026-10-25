import { afterEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Subject } from 'rxjs';
import { contentSection, ContentSection } from './content-section';

interface Row {
  name: string;
}

describe('contentSection', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  /** A section whose reads are answered by hand, in whatever order. */
  function section(): {
    listing: ContentSection<Row>;
    reads: Subject<{ entries: Row[]; total: number }>[];
  } {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()]
    });
    const reads: Subject<{ entries: Row[]; total: number }>[] = [];
    const listing = TestBed.runInInjectionContext(() =>
      contentSection<Row>('spec.section', () => {
        const read = new Subject<{ entries: Row[]; total: number }>();
        reads.push(read);
        return read;
      })
    );
    return { listing, reads };
  }

  function page(name: string): { entries: Row[]; total: number } {
    return { entries: [{ name }], total: 1 };
  }

  /**
   * A filter typed a character at a time asks for several pages inside a round
   * trip of each other, and nothing makes the answers arrive in the order they
   * were asked for. The rows on screen have to be the ones the URL asks for,
   * not whichever response was slowest.
   */
  it('does not let a superseded read paint over a newer one', async () => {
    const { listing, reads } = section();

    const first = listing.resolve();
    const second = listing.resolve();

    reads[1]!.next(page('newer'));
    await second;
    reads[0]!.next(page('older'));
    await first;

    expect(listing.entries()).toEqual([{ name: 'newer' }]);
  });

  /** A retry is the newest answer too: it is the one the reader just asked for. */
  it('keeps a retry’s answer over a read it overtook', async () => {
    const { listing, reads } = section();

    const resolved = listing.resolve();
    const retried = listing.retry();

    reads[1]!.next(page('retried'));
    await retried;
    reads[0]!.next(page('overtaken'));
    await resolved;

    expect(listing.entries()).toEqual([{ name: 'retried' }]);
    expect(listing.retrying()).toBe(false);
  });
});
