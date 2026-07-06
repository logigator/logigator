import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgConfirmPopup } from './confirm-popup';
import { ConfirmationService } from './confirmation.service';

@Component({
  imports: [LgConfirmPopup],
  template: `
    <button #anchor type="button">delete</button>
    <lg-confirm-popup key="inline" />
  `
})
class HostComponent {}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function popup(): HTMLElement | null {
  return document.querySelector('.cdk-overlay-container .relative');
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  const anchor = f.nativeElement.querySelector('button') as HTMLButtonElement;
  return { f, anchor, service: TestBed.inject(ConfirmationService) };
}

describe('LgConfirmPopup', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('opens anchored to target for a matching key and shows the message', () => {
    const { f, anchor, service } = setup();
    service.confirm({
      key: 'inline',
      target: anchor,
      message: 'Delete it?',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel'
    });
    f.detectChanges();
    expect(popup()).not.toBeNull();
    expect(container()?.textContent).toContain('Delete it?');
  });

  it('runs accept and closes on the accept button', () => {
    const { f, anchor, service } = setup();
    const accept = vi.fn();
    service.confirm({
      key: 'inline',
      target: anchor,
      message: 'm',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept
    });
    f.detectChanges();
    const buttons = container()!.querySelectorAll('button');
    (buttons[buttons.length - 1] as HTMLButtonElement).click();
    f.detectChanges();
    expect(accept).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });

  it('rejects on outside (backdrop) click', () => {
    const { f, anchor, service } = setup();
    const accept = vi.fn();
    const reject = vi.fn();
    service.confirm({
      key: 'inline',
      target: anchor,
      message: 'm',
      accept,
      reject
    });
    f.detectChanges();
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    f.detectChanges();
    expect(accept).not.toHaveBeenCalled();
    expect(reject).toHaveBeenCalledTimes(1);
    expect(popup()).toBeNull();
  });

  it('ignores confirmations with a different key', () => {
    const { f, anchor, service } = setup();
    service.confirm({ target: anchor, message: 'm' }); // keyless → dialog
    f.detectChanges();
    expect(popup()).toBeNull();
  });
});
