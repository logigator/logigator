import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LgConfirmDialog } from './confirm-dialog';
import { ConfirmationService } from './confirmation.service';

@Component({
  imports: [LgConfirmDialog],
  template: `<lg-confirm-dialog />`
})
class HostComponent {}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function dialog(): HTMLElement | null {
  return document.querySelector('.cdk-overlay-container [role=dialog]');
}

function setup() {
  const f = TestBed.createComponent(HostComponent);
  f.detectChanges();
  return { f, service: TestBed.inject(ConfirmationService) };
}

describe('LgConfirmDialog', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('renders a keyless confirmation with its message and labels', () => {
    const { f, service } = setup();
    service.confirm({
      header: 'Discard?',
      message: 'Lose changes?',
      acceptLabel: 'Discard',
      rejectLabel: 'Keep',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true }
    });
    f.detectChanges();
    expect(dialog()).not.toBeNull();
    expect(container()?.querySelector('h2')?.textContent).toContain('Discard?');
    expect(container()?.textContent).toContain('Lose changes?');
    const labels = Array.from(container()!.querySelectorAll('button')).map(
      (b) => b.textContent?.trim()
    );
    expect(labels).toContain('Keep');
    expect(labels).toContain('Discard');
  });

  it('runs accept and closes when the accept button is clicked', () => {
    const { f, service } = setup();
    const accept = vi.fn();
    service.confirm({
      message: 'm',
      acceptLabel: 'Yes',
      rejectLabel: 'No',
      accept
    });
    f.detectChanges();
    // Footer buttons are reject then accept.
    const buttons = container()!.querySelectorAll('button');
    (buttons[buttons.length - 1] as HTMLButtonElement).click();
    f.detectChanges();
    expect(accept).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('rejects (no accept) on Escape', () => {
    const { f, service } = setup();
    const accept = vi.fn();
    const reject = vi.fn();
    service.confirm({ message: 'm', accept, reject });
    f.detectChanges();
    dialog()!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    f.detectChanges();
    expect(accept).not.toHaveBeenCalled();
    expect(reject).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('ignores keyed confirmations (they route to the popup)', () => {
    const { f, service } = setup();
    service.confirm({ key: 'inline', message: 'm' });
    f.detectChanges();
    expect(dialog()).toBeNull();
  });
});
