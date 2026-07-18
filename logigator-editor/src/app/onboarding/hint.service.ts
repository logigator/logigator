import {
  ComponentRef,
  effect,
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

/**
 * Fires the just-in-time hints. Subscribes to the triggers (work-mode signal,
 * inspection-open signal, compact breakpoint) and, the first time each fires,
 * shows a small dismissible popover — unless tips are off, a tutorial is
 * running, the hint was already seen, or its platform/completion gate excludes
 * it. At most one hint shows at a time; a trigger that fires while one is up is
 * dropped. Instantiated by the app shell for its side effects.
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

  private readonly mode$ = toObservable(this.workMode.mode);

  private overlayRef: OverlayRef | null = null;
  private currentId: string | null = null;
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
    this.show(hint);
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

  private show(hint: Hint): void {
    const platform = this.onboarding.platform();
    const target = this.resolveTarget(hint, platform);

    if (target) {
      this.overlayRef = this.overlayService.connected({
        origin: target,
        positions: connectedPositions('bottom')
      });
    } else {
      this.overlayRef = this.overlayService.global({
        placement: 'bottom',
        hasBackdrop: false
      });
    }

    const cmp: ComponentRef<HintPopoverComponent> = this.overlayRef.attach(
      new ComponentPortal(HintPopoverComponent, null, this.injector)
    );
    cmp.setInput(
      'text',
      this.translation.translate(this.resolveText(hint.text, platform))
    );
    this.currentId = hint.id;

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

  private dismiss(): void {
    if (this.currentId !== null) {
      this.logging.debug(`dismiss hint ${this.currentId}`, 'HintService');
    }
    document.removeEventListener('keydown', this.onKeydown, true);
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.currentId = null;
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
    const selector = hint.target?.[platform];
    if (!selector) return null;
    return document.querySelector<HTMLElement>(selector);
  }

  private resolveText(
    text: StepText,
    platform: OnboardingPlatform
  ): TranslationKey {
    if (typeof text === 'string') return text;
    return (text[platform] ?? text.desktop ?? text.compact) as TranslationKey;
  }
}
