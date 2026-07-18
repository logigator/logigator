import { beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { OnboardTargetDirective } from './onboard-target.directive';
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';

@Component({
  imports: [OnboardTargetDirective],
  template: `@if (show()) {
    <button [appOnboardTarget]="id()"></button>
  }`
})
class HostComponent {
  readonly id = signal('tool-wire');
  readonly show = signal(true);
}

describe('OnboardTargetDirective', () => {
  let registry: OnboardingTargetRegistry;
  const button = (fixture: {
    nativeElement: HTMLElement;
  }): HTMLElement | null => fixture.nativeElement.querySelector('button');

  beforeEach(() => {
    configureTestBed([], [HostComponent]);
    registry = TestBed.inject(OnboardingTargetRegistry);
  });

  it('registers the host element and settles without a CD loop', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    // Would hang / throw if the registering effect re-triggered itself.
    TestBed.inject(ApplicationRef).tick();

    expect(registry.get('tool-wire')).toBe(button(fixture));
  });

  it('re-registers under the new id when the binding changes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = button(fixture);

    fixture.componentInstance.id.set('tool-erase');
    fixture.detectChanges();

    expect(registry.get('tool-wire')).toBeNull();
    expect(registry.get('tool-erase')).toBe(el);
  });

  it('unregisters when its element is removed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    fixture.componentInstance.show.set(false);
    fixture.detectChanges();

    expect(registry.get('tool-wire')).toBeNull();
  });
});
