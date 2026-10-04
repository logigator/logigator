import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ListingSearch } from './listing-search';

/** Longer than the field's own debounce, so a pause is unambiguous. */
const PAUSE = 400;

describe('ListingSearch', () => {
  let fixture: ComponentFixture<ListingSearch>;
  let asked: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.resetTestingModule();
    configureTestBed();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function render(search = ''): void {
    fixture = TestBed.createComponent(ListingSearch);
    fixture.componentRef.setInput('action', '/en/community/projects');
    fixture.componentRef.setInput('label', 'Search');
    fixture.componentRef.setInput('placeholder', 'Search the community');
    fixture.componentRef.setInput('search', search);

    asked = [];
    fixture.componentInstance.searchChange.subscribe((value) =>
      asked.push(value)
    );
    fixture.detectChanges();
  }

  function field(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[name=search]');
  }

  function type(text: string): void {
    const input = field();
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  /** What the URL now says, which is how the answer to a search comes back. */
  function urlSays(search: string): void {
    fixture.componentRef.setInput('search', search);
    fixture.detectChanges();
  }

  /**
   * The whole point of the debounce: a listing is read once for the word, not
   * once for every character of it — each read being a request that re-resolves
   * the page.
   */
  it('asks once for a word rather than once per keystroke', () => {
    render();

    type('a');
    vi.advanceTimersByTime(100);
    type('ad');
    vi.advanceTimersByTime(100);
    type('adder');
    vi.advanceTimersByTime(PAUSE);

    expect(asked).toEqual(['adder']);
  });

  /**
   * Enter is an answer now rather than in a fifth of a second, and the
   * keystroke still sitting in the debounce must not ask for the same thing
   * again behind it.
   */
  it('answers Enter without waiting, and only once', () => {
    render();

    type('adder');
    fixture.nativeElement.querySelector('form').requestSubmit();
    expect(asked).toEqual(['adder']);

    vi.advanceTimersByTime(PAUSE);
    expect(asked).toEqual(['adder']);
  });

  /**
   * A read is slower than a keystroke, so the field cannot simply show what the
   * URL says: by the time the URL catches up, there is newer text in the field
   * and putting the older text back would swallow whatever was typed meanwhile.
   */
  it('keeps what was typed while the answer was on its way', () => {
    render();

    type('add');
    vi.advanceTimersByTime(PAUSE);
    type('adder');
    urlSays('add');

    expect(field().value).toBe('adder');
  });

  /**
   * A URL that moved anywhere else is someone else's doing — the empty state's
   * *clear* link, or the back button — and the field has to follow it, right
   * down to being able to ask for the filter it was just taken off.
   */
  it('follows a filter cleared from outside the field', () => {
    render();

    type('adder');
    vi.advanceTimersByTime(PAUSE);
    urlSays('adder');
    urlSays('');
    expect(field().value).toBe('');

    type('adder');
    vi.advanceTimersByTime(PAUSE);
    expect(asked).toEqual(['adder', 'adder']);
  });

  /** Whitespace is not a filter, and a trailing space is not a new one. */
  it('trims what it asks for, and asks nothing for a trailing space', () => {
    render();

    type('  adder ');
    vi.advanceTimersByTime(PAUSE);
    urlSays('adder');
    type('adder ');
    vi.advanceTimersByTime(PAUSE);

    expect(asked).toEqual(['adder']);
  });
});
