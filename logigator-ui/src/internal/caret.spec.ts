import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgCaret } from './caret';
import { LgOverlaySide } from './overlay';

@Component({
  imports: [LgCaret],
  template: '<lg-caret [side]="side()" [offset]="offset()" />'
})
class Host {
  readonly side = signal<LgOverlaySide>('bottom');
  readonly offset = signal(0);
}

function caret(fixture: { nativeElement: HTMLElement }): HTMLElement {
  return fixture.nativeElement.querySelector('lg-caret')!;
}

describe('LgCaret', () => {
  // The offset slides the caret along the edge it sits on, so which axis it
  // moves along is decided by the side — the wrong one walks it off the panel.
  it('offsets along the edge the caret sits on', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.offset.set(24);
    fixture.detectChanges();

    // A panel below/above its anchor carries the caret on a horizontal edge.
    expect(caret(fixture).style.marginLeft).toBe('24px');
    expect(caret(fixture).style.marginTop).toBe('0px');

    fixture.componentInstance.side.set('right');
    fixture.detectChanges();

    // Beside the anchor, the caret rides a vertical edge instead.
    expect(caret(fixture).style.marginTop).toBe('24px');
    expect(caret(fixture).style.marginLeft).toBe('0px');
  });
});
