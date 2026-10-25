import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgFocusTrap, SKIP_INITIAL_FOCUS } from './focus-trap';

// jsdom lays nothing out, and the checker counts an element without geometry
// as hidden, so nothing would be focusable.
class LaidOutChecker extends InteractivityChecker {
  override isVisible(): boolean {
    return true;
  }
}

describe('LgFocusTrap', () => {
  const cleanup: HTMLElement[] = [];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: InteractivityChecker, useClass: LaidOutChecker }]
    });
  });

  afterEach(() => {
    cleanup.forEach((el) => el.remove());
    cleanup.length = 0;
  });

  function add<T extends HTMLElement>(el: T): T {
    document.body.appendChild(el);
    cleanup.push(el);
    return el;
  }

  /** A surface of buttons, the ones named in `skipped` marked to be passed over. */
  function surface(names: string[], skipped: string[] = []): HTMLElement {
    const root = add(document.createElement('div'));
    for (const name of names) {
      const button = root.appendChild(document.createElement('button'));
      button.textContent = name;
      if (skipped.includes(name)) button.setAttribute(SKIP_INITIAL_FOCUS, '');
    }
    return root;
  }

  function trap(root: HTMLElement): LgFocusTrap {
    const focusTrap = new LgFocusTrap(TestBed.inject(Injector));
    focusTrap.trapFocus(root);
    TestBed.inject(ApplicationRef).tick();
    return focusTrap;
  }

  it('restores focus to the pre-trap element on release', () => {
    const opener = add(document.createElement('button'));
    opener.focus();
    expect(document.activeElement).toBe(opener);

    trap(surface(['ok'])).release();

    expect(document.activeElement).toBe(opener);
  });

  it('focuses the first tabbable element not marked to be skipped', () => {
    trap(surface(['help', 'close', 'ok'], ['help']));
    expect(document.activeElement?.textContent).toBe('close');
  });

  it('lets a cdkFocusInitial element win over the first tabbable one', () => {
    const root = surface(['help', 'close', 'ok'], ['help']);
    root.lastElementChild!.setAttribute('cdkFocusInitial', '');
    trap(root);
    expect(document.activeElement?.textContent).toBe('ok');
  });

  it('falls back to a skipped element when nothing else can take focus', () => {
    trap(surface(['help'], ['help']));
    expect(document.activeElement?.textContent).toBe('help');
  });
});
