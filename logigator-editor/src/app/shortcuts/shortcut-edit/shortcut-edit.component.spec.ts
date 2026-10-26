import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { ShortcutBinding } from '../shortcut-binding.model';
import { ShortcutEditComponent } from './shortcut-edit.component';

@Component({
  imports: [ShortcutEditComponent],
  template: `
    <div role="dialog" class="manager">
      <app-shortcut-edit [(bindings)]="bindings" />
    </div>
    <div role="dialog" class="stacked"><input /></div>
  `
})
class Host {
  readonly bindings = signal<ShortcutBinding[]>([]);
}

describe('ShortcutEditComponent', () => {
  beforeEach(() => configureTestBed([], [Host]));

  afterEach(() => TestBed.resetTestingModule());

  const key = (k: string): ShortcutBinding => ({
    key: k,
    ctrl: false,
    shift: false,
    alt: false
  });

  function render(initial: ShortcutBinding[] = []) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.bindings.set(initial);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    fixture.detectChanges();
    return fixture;
  }

  // By what the buttons show, not their labels: the language bundle may not
  // have loaded yet.
  const ADD = 'button:has(.ph-plus)';
  const CHANGE = 'button:has(lg-shortcut)';
  const REMOVE = 'button:has(.ph-x)';

  /** Clicks the `nth` manager button matching `selector`. */
  function click(
    fixture: ReturnType<typeof render>,
    selector: string,
    nth = 0
  ): void {
    const button = (
      fixture.nativeElement as HTMLElement
    ).querySelectorAll<HTMLElement>(`.manager ${selector}`)[nth];
    if (!button) throw new Error(`no button ${selector} #${nth}`);
    button.click();
    fixture.detectChanges();
  }

  function record() {
    const fixture = render();
    click(fixture, ADD);
    return fixture;
  }

  function press(target: EventTarget, key: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }

  it('records nothing typed into a dialog stacked over it, and keeps recording', () => {
    const fixture = record();
    press(fixture.nativeElement.querySelector('.stacked input'), 'k');
    expect(fixture.componentInstance.bindings()).toEqual([]);

    press(document.body, 'k');
    expect(fixture.componentInstance.bindings()).toEqual([
      { key: 'k', ctrl: false, shift: false, alt: false }
    ]);
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('adds a recorded binding after the existing ones', () => {
    const fixture = render([key('a')]);
    click(fixture, ADD);
    press(document.body, 'b');

    expect(fixture.componentInstance.bindings()).toEqual([key('a'), key('b')]);
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('re-records one binding in place, keeping the others', () => {
    const fixture = render([key('a'), key('b')]);
    click(fixture, CHANGE);
    press(document.body, 'c');

    expect(fixture.componentInstance.bindings()).toEqual([key('c'), key('b')]);
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('removes one binding, keeping the others', () => {
    const fixture = render([key('a'), key('b')]);
    click(fixture, REMOVE);

    expect(fixture.componentInstance.bindings()).toEqual([key('b')]);
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('never lists a combination twice', () => {
    const fixture = render([key('a'), key('b')]);
    click(fixture, ADD);
    press(document.body, 'A');

    expect(fixture.componentInstance.bindings()).toEqual([key('b'), key('A')]);
    (fixture.nativeElement as HTMLElement).remove();
  });

  it('changes nothing when a recording is cancelled with Escape', () => {
    const fixture = render([key('a')]);
    click(fixture, CHANGE);
    press(document.body, 'Escape');

    expect(fixture.componentInstance.bindings()).toEqual([key('a')]);
    (fixture.nativeElement as HTMLElement).remove();
  });
});
