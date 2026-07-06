import { afterEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgPopover } from './popover';

@Component({
  imports: [LgPopover],
  template: `<button (click)="pop.toggle($event)">open</button>
    <lg-popover #pop>POP CONTENT</lg-popover>`
})
class HostComponent {}

function overlayText(): string {
  return document.querySelector('.cdk-overlay-container')?.textContent ?? '';
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const button = f.nativeElement.querySelector('button') as HTMLButtonElement;
  return { f, button };
}

describe('LgPopover', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('toggles the projected content open and closed', () => {
    const { f, button } = setup();
    button.click();
    f.detectChanges();
    expect(overlayText()).toContain('POP CONTENT');

    button.click();
    f.detectChanges();
    expect(overlayText()).not.toContain('POP CONTENT');
  });

  it('closes on outside (backdrop) click', () => {
    const { f, button } = setup();
    button.click();
    f.detectChanges();
    const backdrop = document.querySelector(
      '.cdk-overlay-backdrop'
    ) as HTMLElement;
    backdrop.click();
    f.detectChanges();
    expect(overlayText()).not.toContain('POP CONTENT');
  });
});
