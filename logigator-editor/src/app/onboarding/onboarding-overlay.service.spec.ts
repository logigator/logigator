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
  isFinal: false,
  placement: 'bottom'
};

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function tick(): void {
  TestBed.inject(ApplicationRef).tick();
}

/** Wait out the settle frames after which show() mounts the bubble. */
function settled(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    )
  );
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
    handlers = { skip: vi.fn(), next: vi.fn() };
    target = document.createElement('button');
    document.body.appendChild(target);
  });

  afterEach(() => {
    service.hide();
    container()?.remove();
    target.remove();
  });

  it('renders the bubble and dim, and tears both down on hide', async () => {
    service.show(target, VIEW, handlers);
    tick();
    // The dim is up immediately; the bubble mounts once the anchor settles.
    expect(
      container()?.querySelector('app-coach-mark-backdrop')
    ).not.toBeNull();
    await settled();
    tick();
    expect(container()?.textContent).toContain('Place an AND gate');

    service.hide();
    expect(container()?.textContent ?? '').not.toContain('Place an AND gate');
  });

  it('leaves Escape to the board and does not skip on it', async () => {
    service.show(target, VIEW, handlers);
    await settled();
    tick();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(handlers.skip).not.toHaveBeenCalled();
  });

  it('refreshes content in place when the target is unchanged', async () => {
    service.show(target, VIEW, handlers);
    await settled();
    tick();
    service.show(target, { ...VIEW, title: 'Add two Switches' }, handlers);
    tick();
    const text = container()?.textContent ?? '';
    expect(text).toContain('Add two Switches');
    expect(text).not.toContain('Place an AND gate');
  });

  it('ends the tutorial when cdk disposes the overlays on navigation', async () => {
    service.show(target, VIEW, handlers);
    await settled();
    tick();
    expect(container()?.textContent).toContain('Place an AND gate');

    // `disposeOnNavigation` takes the dim and the bubble behind the service's
    // back; the runner has to hear about it, or the tutorial stays active with
    // nothing on screen.
    window.dispatchEvent(new PopStateEvent('popstate'));
    tick();
    expect(handlers.skip).toHaveBeenCalledTimes(1);
    expect(container()?.textContent ?? '').not.toContain('Place an AND gate');
  });
});
