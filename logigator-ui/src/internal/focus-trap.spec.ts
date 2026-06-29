import { afterEach, describe, expect, it } from 'vitest';
import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { TestBed } from '@angular/core/testing';
import { LgFocusTrap } from './focus-trap';

describe('LgFocusTrap', () => {
  const cleanup: HTMLElement[] = [];

  afterEach(() => {
    cleanup.forEach((el) => el.remove());
    cleanup.length = 0;
  });

  function add<T extends HTMLElement>(el: T): T {
    document.body.appendChild(el);
    cleanup.push(el);
    return el;
  }

  it('restores focus to the pre-trap element on release', () => {
    const opener = add(document.createElement('button'));
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const surface = add(document.createElement('div'));
    surface.appendChild(document.createElement('button'));

    const trap = new LgFocusTrap(TestBed.inject(ConfigurableFocusTrapFactory));
    trap.trapFocus(surface);
    trap.release();

    expect(document.activeElement).toBe(opener);
  });
});
