import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { configureTestBed } from '../../testing/configure-test-bed';
import { CoachMarkHandlers, CoachMarkView } from './coach-mark.model';
import { OnboardingOverlayService } from './onboarding-overlay.service';

const VIEW: CoachMarkView = {
  title: 'Place an AND gate',
  text: 'Drop it on the canvas.',
  stepNumber: 4,
  totalSteps: 9,
  showNext: false,
  placement: 'bottom'
};

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

describe('OnboardingOverlayService', () => {
  let service: OnboardingOverlayService;
  let handlers: CoachMarkHandlers;
  let target: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    configureTestBed();
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');
    service = TestBed.inject(OnboardingOverlayService);
    handlers = { skip: vi.fn(), disableTips: vi.fn(), next: vi.fn() };
    target = document.createElement('button');
    document.body.appendChild(target);
  });

  afterEach(() => {
    service.hide();
    container()?.remove();
    target.remove();
  });

  it('renders the bubble and dim, and tears both down on hide', () => {
    service.show(target, VIEW, handlers);
    tick();
    expect(container()?.textContent).toContain('Place an AND gate');
    expect(container()?.querySelector('.bg-black\\/30')).not.toBeNull();

    service.hide();
    expect(container()?.textContent ?? '').not.toContain('Place an AND gate');
  });

  it('maps Escape to skip', () => {
    service.show(target, VIEW, handlers);
    tick();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(handlers.skip).toHaveBeenCalledOnce();
  });

  it('refreshes content in place when the target is unchanged', () => {
    service.show(target, VIEW, handlers);
    tick();
    service.show(target, { ...VIEW, title: 'Add two Switches' }, handlers);
    tick();
    const text = container()?.textContent ?? '';
    expect(text).toContain('Add two Switches');
    expect(text).not.toContain('Place an AND gate');
  });
});
