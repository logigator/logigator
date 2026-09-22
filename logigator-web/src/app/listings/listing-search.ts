import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LgIconField, LgInputIcon, LgInputText } from '@logigator/ui';
import { debounceTime, Subject } from 'rxjs';

/** Long enough that a listing is not re-read mid-word, short enough that the
 * rows still read as an answer to the typing. The documentation field's own. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The filter every listing on this site carries: a real `<form method="get">`
 * that answers a keystroke where there is script to claim it.
 *
 * Typing is what searches — debounced, so a listing is read once per pause
 * rather than once per character — and Enter answers now rather than waiting
 * the debounce out. Either way the page it is on writes the URL and the guard
 * re-resolves, so a filter stays shareable, reloadable and in the back button.
 *
 * The one piece of state here is what the field shows. It cannot simply be the
 * URL's: a read is slower than a keystroke, so the answer coming back would
 * overwrite whatever has been typed in the meantime. So the field keeps its own
 * value and adopts the URL's only when that moved somewhere this field did not
 * put it — the back button, or the empty state's *clear* link.
 */
@Component({
  selector: 'web-listing-search',
  imports: [LgIconField, LgInputIcon, LgInputText],
  templateUrl: './listing-search.html',
  // The host is the layout box a page sizes, so it has to be one.
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListingSearch {
  /** Where a submit goes with no script to claim it: the listing's own path. */
  public readonly action = input.required<string>();
  public readonly label = input.required<string>();
  public readonly placeholder = input.required<string>();

  /** The filter the URL currently carries. */
  public readonly search = input('');

  /** A new filter, trimmed, for the page to put on the URL. */
  public readonly searchChange = output<string>();

  /** The last filter this field asked for, so its own echo is recognisable.
   * Deliberately not a signal: what the field shows must not be recomputed
   * when it changes, that being the moment the field is furthest ahead. */
  private pushed: string | null = null;

  /**
   * What the field shows. The URL is its source — the *clear* link and the back
   * button both have to reach the field — except where what arrives is this
   * field's own echo, which by then is older than what is in the field.
   */
  protected readonly value = linkedSignal<string, string>({
    source: this.search,
    computation: (incoming, previous) => {
      if (previous && incoming === this.pushed) return previous.value;
      // Anything else moved the URL, so the echo this field was waiting for is
      // never coming, and what it shows is stale.
      this.pushed = null;
      return incoming;
    }
  });

  private readonly typed = new Subject<string>();

  constructor() {
    this.typed
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed())
      .subscribe((value) => this.emit(value));
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value.set(value);
    this.typed.next(value);
  }

  /**
   * Enter answers immediately. The keystroke still sitting in the debounce
   * fires afterwards with the same text, which `emit` then recognises as
   * nothing new — so the two do not navigate twice.
   */
  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.emit(untracked(this.value));
  }

  private emit(raw: string): void {
    const search = raw.trim();
    if (search === untracked(this.search) || search === this.pushed) return;
    this.pushed = search;
    this.searchChange.emit(search);
  }
}
