import {
  Directive,
  ElementRef,
  effect,
  inject,
  input,
  untracked
} from '@angular/core';
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';

/**
 * Registers its host element with {@link OnboardingTargetRegistry} under the
 * bound id, re-registering when the id changes and unregistering on destroy.
 */
@Directive({
  selector: '[appOnboardTarget]'
})
export class OnboardTargetDirective {
  public readonly id = input.required<string>({ alias: 'appOnboardTarget' });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly registry = inject(OnboardingTargetRegistry);

  constructor() {
    effect((onCleanup) => {
      const id = this.id();
      const element = this.host.nativeElement;
      // Untracked, so a registry write can never re-trigger this effect.
      untracked(() => this.registry.register(id, element));
      onCleanup(() => this.registry.unregister(id, element));
    });
  }
}
