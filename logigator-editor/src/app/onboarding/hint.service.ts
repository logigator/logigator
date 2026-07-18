import {
  ComponentRef,
  effect,
  EffectRef,
  inject,
  Injectable,
  Injector,
  untracked
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ConnectedOverlayPositionChange,
  FlexibleConnectedPositionStrategy,
  OverlayRef
} from '@angular/cdk/overlay';
import { Subscription } from 'rxjs';
import {
  connectedPositions,
  LgOverlayService,
  sideOfPosition
} from '@logigator/ui';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { ProjectService } from '../project/project.service';
import { InspectionService } from '../inspection/inspection.service';
import { LoggingService } from '../logging/logging.service';
import { TranslationService } from '../translation/translation.service';
import { TranslationKey } from '../translation/translation-key.model';
import { OnboardingPlatform, OnboardingService } from './onboarding.service';
import { StepText } from './tutorial.model';
import { Hint } from './hint.model';
import { HintPopoverComponent } from './hint/hint-popover.component';
import { HINTS } from './hints/registry';
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';

/**
 * Fires the just-in-time hints. Subscribes to the triggers (work-mode signal,
 * inspection-open signal, compact breakpoint) and, the first time each fires,
 * shows a small dismissible popover — unless tips are off, a tutorial is
 * running, the hint was already seen, or its platform/completion gate excludes
 * it. At most one hint shows at a time; a trigger that fires while one is up is
 * dropped. Instantiated by the app shell for its side effects.
 *
 * Once open, a hint stays anchored reactively: a per-hint effect re-resolves its
 * target from {@link OnboardingTargetRegistry}, so the popover follows the
 * element as it enters, leaves, or is re-created (floating bottom-centre while
 * there is no target) with no querySelector timing race.
 */
@Injectable({ providedIn: 'root' })
export class HintService {
  private readonly onboarding = inject(OnboardingService);
  private readonly overlayService = inject(LgOverlayService);
  private readonly injector = inject(Injector);
  private readonly workMode = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly inspection = inject(InspectionService);
  private readonly translation = inject(TranslationService);
  private readonly logging = inject(LoggingService);
  private readonly registry = inject(OnboardingTargetRegistry);

  private readonly mode$ = toObservable(this.workMode.mode);

  private overlayRef: OverlayRef | null = null;
  private currentId: string | null = null;
  /** The element the live overlay is anchored to (null = floated). */
  private currentTarget: HTMLElement | null = null;
  /** Per-hint effect that tracks the target element and re-anchors reactively. */
  private targetEffect: EffectRef | null = null;
  private subscriptions = new Subscription();
  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') this.dismiss();
  };

  constructor() {
    this.mode$.subscribe((mode) => this.onMode(mode));

    // Inspecting a component during a running simulation.
    effect(() => {
      const open = this.inspection.open();
      untracked(() => {
        if (open && this.workMode.mode() === WorkMode.SIMULATION) {
          this.fire('inspect-component');
        }
      });
    });

    // First compact board load with nothing built yet.
    effect(() => {
      const compact = this.onboarding.platform() === 'compact';
      const project = this.projectService.mainProject();
      untracked(() => {
        if (compact && project && this.isEmpty()) {
          this.fire('pan-zoom-compact');
        }
      });
    });
  }

  private onMode(mode: WorkMode): void {
    // A tool switch also clears a showing hint — the user has moved on.
    if (this.currentId !== null) this.dismiss();
    const hint = HINTS.find(
      (candidate) =>
        candidate.trigger.kind === 'workMode' && candidate.trigger.mode === mode
    );
    if (hint) this.fire(hint.id);
  }

  private fire(id: string): void {
    if (this.currentId !== null) return; // one at a time; drop the newer
    const hint = HINTS.find((candidate) => candidate.id === id);
    if (!hint) return;
    if (!this.canShow(hint)) {
      this.logging.debug(`hint ${id} suppressed`, 'HintService');
      return;
    }
    this.onboarding.markHintSeen(id);
    this.logging.debug(`serve hint ${id}`, 'HintService');
    this.open(hint);
  }

  private canShow(hint: Hint): boolean {
    if (!this.onboarding.isTipsEnabled()) return false;
    if (this.onboarding.activeTutorial() !== null) return false;
    if (this.onboarding.hasSeenHint(hint.id)) return false;
    const platform = this.onboarding.platform();
    if (hint.platforms && !hint.platforms.includes(platform)) return false;
    if (
      hint.suppressIfCompleted &&
      this.onboarding.hasCompletedTutorial(hint.suppressIfCompleted)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Opens a hint and keeps it anchored reactively: the effect re-resolves the
   * target from the registry (and the platform), so the popover follows its
   * element as it enters, leaves, or is re-created in the DOM — no querySelector
   * race, no manual deferral. Torn down as one unit by {@link dismiss}.
   */
  private open(hint: Hint): void {
    this.currentId = hint.id;
    this.targetEffect = effect(
      () => {
        const platform = this.onboarding.platform();
        const target = this.resolveTarget(hint, platform); // tracks the registry
        untracked(() => this.mount(hint, target, platform));
      },
      { injector: this.injector }
    );
  }

  /**
   * (Re)builds the overlay for the open hint. A no-op when the anchor is
   * unchanged; otherwise it swaps between an anchored (connected, with caret)
   * and a floated (bottom-centre) placement as the target comes and goes.
   */
  private mount(
    hint: Hint,
    target: HTMLElement | null,
    platform: OnboardingPlatform
  ): void {
    if (this.overlayRef && target === this.currentTarget) return;
    this.currentTarget = target;
    this.teardownOverlay();

    if (target) {
      this.overlayRef = this.overlayService.connected({
        origin: target,
        positions: connectedPositions('bottom')
      });
    } else {
      // No anchor (targetless hint, or its target isn't registered): float it
      // bottom-centre, well clear of the bottom chrome — lifted higher on
      // compact where the tool/sim bars occupy the bottom edge.
      this.overlayRef = this.overlayService.global({
        placement: 'bottom-center',
        hasBackdrop: false,
        panelClass: ['mb-24', 'lg:mb-16']
      });
    }

    const cmp: ComponentRef<HintPopoverComponent> = this.overlayRef.attach(
      new ComponentPortal(HintPopoverComponent, null, this.injector)
    );
    cmp.setInput(
      'text',
      this.translation.translate(this.resolveText(hint.text, platform))
    );

    this.subscriptions.add(
      cmp.instance.dismiss.subscribe(() => this.dismiss())
    );
    this.subscriptions.add(
      cmp.instance.disableTips.subscribe(() => {
        this.dismiss();
        this.onboarding.disableAllTips();
      })
    );
    if (target) this.trackCaretSide(this.overlayRef, cmp);
    document.addEventListener('keydown', this.onKeydown, true);
  }

  /** Disposes the current overlay instance and its listeners (keeps the effect). */
  private teardownOverlay(): void {
    document.removeEventListener('keydown', this.onKeydown, true);
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  private dismiss(): void {
    if (this.currentId !== null) {
      this.logging.debug(`dismiss hint ${this.currentId}`, 'HintService');
    }
    this.targetEffect?.destroy();
    this.targetEffect = null;
    this.teardownOverlay();
    this.currentId = null;
    this.currentTarget = null;
  }

  private trackCaretSide(
    ref: OverlayRef,
    cmp: ComponentRef<HintPopoverComponent>
  ): void {
    const strategy = ref.getConfig()
      .positionStrategy as FlexibleConnectedPositionStrategy;
    this.subscriptions.add(
      strategy.positionChanges.subscribe(
        (change: ConnectedOverlayPositionChange) => {
          cmp.setInput('side', sideOfPosition(change.connectionPair));
        }
      )
    );
  }

  private isEmpty(): boolean {
    const project = this.projectService.mainProject();
    return !project || [...project.components].length === 0;
  }

  private resolveTarget(
    hint: Hint,
    platform: OnboardingPlatform
  ): HTMLElement | null {
    return this.registry.get(hint.target?.[platform]);
  }

  private resolveText(
    text: StepText,
    platform: OnboardingPlatform
  ): TranslationKey {
    if (typeof text === 'string') return text;
    return (text[platform] ?? text.desktop ?? text.compact) as TranslationKey;
  }
}
