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
import { OverlayRef } from '@angular/cdk/overlay';
import { EMPTY, Subscription, switchMap } from 'rxjs';
import {
  caretSideChanges,
  connectedPositions,
  LgOverlayService
} from '@logigator/ui';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { ProjectService } from '../project/project.service';
import { InspectionService } from '../inspection/inspection.service';
import { LoggingService } from '../logging/logging.service';
import { TranslationService } from '../translation/translation.service';
import { OnboardingPlatform, OnboardingService } from './onboarding.service';
import { resolveStepText } from './tutorial.model';
import { Hint } from './hint.model';
import { HintPopoverComponent } from './hint/hint-popover.component';
import { hintForTrigger } from './hints/registry';
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';

/** Everything one showing hint owns; {@link dismiss} disposes it as a unit. */
interface HintSession {
  readonly hint: Hint;
  /** Per-hint effect that tracks the target element and re-anchors reactively. */
  effectRef: EffectRef | null;
  overlayRef: OverlayRef | null;
  /** The element the live overlay is anchored to (null = floated). */
  target: HTMLElement | null;
  /** Replaced on every remount; the effect outlives individual overlays. */
  subscriptions: Subscription;
}

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
  private readonly activeProject$ = toObservable(
    this.projectService.activeProject
  );

  /** The showing hint, or null (at most one at a time). */
  private session: HintSession | null = null;
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
          this.fire(hintForTrigger({ kind: 'inspect' }));
        }
      });
    });

    // First compact board load with nothing built yet.
    effect(() => {
      const compact = this.onboarding.platform() === 'compact';
      const project = this.projectService.mainProject();
      untracked(() => {
        if (compact && project && this.isEmpty()) {
          this.fire(hintForTrigger({ kind: 'compactEmpty' }));
        }
      });
    });

    // First deliberate multi-element selection — teaches the rotate/move keys.
    this.activeProject$
      .pipe(
        switchMap(
          (project) => project?.selectionManager.selectionChange$ ?? EMPTY
        )
      )
      .subscribe(() => {
        if (this.selectionSize() >= 2) {
          this.fire(hintForTrigger({ kind: 'select' }));
        }
      });

    // First paste — the ghosts follow the cursor rather than dropping in place.
    this.activeProject$
      .pipe(switchMap((project) => project?.pasteRequest$ ?? EMPTY))
      .subscribe(() => this.fire(hintForTrigger({ kind: 'paste' })));
  }

  private onMode(mode: WorkMode): void {
    // A tool switch also clears a showing hint — the user has moved on.
    if (this.session) this.dismiss();
    this.fire(hintForTrigger({ kind: 'workMode', mode }));
  }

  private fire(hint: Hint | undefined): void {
    if (!hint) return;
    if (this.session) return; // one at a time; drop the newer
    if (!this.canShow(hint)) {
      this.logging.debug(`hint ${hint.id} suppressed`, 'HintService');
      return;
    }
    this.onboarding.markHintSeen(hint.id);
    this.logging.debug(`serve hint ${hint.id}`, 'HintService');
    this.open(hint);
  }

  private canShow(hint: Hint): boolean {
    if (!this.onboarding.tipsEnabled()) return false;
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
    const session: HintSession = {
      hint,
      effectRef: null,
      overlayRef: null,
      target: null,
      subscriptions: new Subscription()
    };
    this.session = session;
    session.effectRef = effect(
      () => {
        const platform = this.onboarding.platform();
        const target = this.resolveTarget(hint, platform); // tracks the registry
        untracked(() => this.mount(session, target, platform));
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
    session: HintSession,
    target: HTMLElement | null,
    platform: OnboardingPlatform
  ): void {
    if (session.overlayRef && target === session.target) return;
    session.target = target;
    this.teardownOverlay(session);

    if (target) {
      session.overlayRef = this.overlayService.connected({
        origin: target,
        positions: connectedPositions('bottom')
      });
    } else {
      // No anchor (targetless hint, or its target isn't registered): float it
      // bottom-centre, well clear of the bottom chrome — lifted higher on
      // compact where the tool/sim bars occupy the bottom edge.
      session.overlayRef = this.overlayService.global({
        placement: 'bottom-center',
        hasBackdrop: false,
        panelClass: ['mb-24', 'lg:mb-16']
      });
    }

    const cmp: ComponentRef<HintPopoverComponent> = session.overlayRef.attach(
      new ComponentPortal(HintPopoverComponent, null, this.injector)
    );
    cmp.setInput(
      'text',
      this.translation.translate(resolveStepText(session.hint.text, platform))
    );

    session.subscriptions.add(
      cmp.instance.dismiss.subscribe(() => this.dismiss())
    );
    session.subscriptions.add(
      cmp.instance.disableTips.subscribe(() => {
        this.dismiss();
        this.onboarding.disableAllTips();
      })
    );
    if (target) {
      // Point the caret at the anchor from whichever side CDK actually placed it.
      session.subscriptions.add(
        caretSideChanges(session.overlayRef).subscribe((side) =>
          cmp.setInput('side', side)
        )
      );
    }
    document.addEventListener('keydown', this.onKeydown, true);
  }

  /** Disposes the session's overlay instance and its listeners (keeps the effect). */
  private teardownOverlay(session: HintSession): void {
    document.removeEventListener('keydown', this.onKeydown, true);
    session.subscriptions.unsubscribe();
    session.subscriptions = new Subscription();
    session.overlayRef?.dispose();
    session.overlayRef = null;
  }

  private dismiss(): void {
    const session = this.session;
    if (!session) return;
    this.logging.debug(`dismiss hint ${session.hint.id}`, 'HintService');
    this.session = null;
    session.effectRef?.destroy();
    this.teardownOverlay(session);
  }

  private isEmpty(): boolean {
    const project = this.projectService.mainProject();
    return !project || project.componentCount === 0;
  }

  private selectionSize(): number {
    const selection = this.projectService.activeProject()?.selectionManager;
    if (!selection) return 0;
    return selection.selectedComponents.size + selection.selectedWires.size;
  }

  private resolveTarget(
    hint: Hint,
    platform: OnboardingPlatform
  ): HTMLElement | null {
    return this.registry.get(hint.target?.[platform]);
  }
}
