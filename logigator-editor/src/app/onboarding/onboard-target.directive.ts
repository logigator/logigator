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
 * Registers its host element as an onboarding target under the bound id, so the
 * hint and tutorial systems can anchor to it reactively (see
 * {@link OnboardingTargetRegistry}). Registration follows the element's lifetime
 * and id: the effect re-registers when the id changes and unregisters when the
 * element is destroyed.
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
      // Registry writes are side effects, not dependencies — keep them out of
      // the effect's tracking so a write can never re-trigger this effect.
      untracked(() => this.registry.register(id, element));
      onCleanup(() => this.registry.unregister(id, element));
    });
  }
}
