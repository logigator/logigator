import {
  afterNextRender,
  AfterRenderRef,
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
import { ScrollDispatcher, ViewportRuler } from '@angular/cdk/scrolling';
import { EMPTY, Subscription, switchMap } from 'rxjs';
import {
  caretOffsetFor,
  caretSideChanges,
  connectedPositions,
  externalTeardown,
  LgOverlayService,
  type LgOverlaySide,
  originVisibilityChanges,
  positionForSide
} from '@logigator/ui';
import { DocumentationService } from '../documentation/documentation.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { ProjectService } from '../project/project.service';
import { LoggingService } from '../logging/logging.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { TranslationService } from '../translation/translation.service';
import { OnboardingPlatform, OnboardingService } from './onboarding.service';
import { resolveStepText } from './tutorial.model';
import { Hint } from './hint.model';
import { HintPopoverComponent } from './hint/hint-popover.component';
import { hintForTrigger } from './hints/registry';
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';

/** `rect` moved down the page by `dy`, as the caret geometry wants it. */
function shiftRect(rect: DOMRect, dy: number): DOMRect {
  return dy === 0
    ? rect
    : new DOMRect(rect.x, rect.y + dy, rect.width, rect.height);
}

/** Everything one showing hint owns; `dismiss` disposes it as a unit. */
interface HintSession {
  readonly hint: Hint;
  /** Tracks the target element and re-anchors reactively. */
  effectRef: EffectRef | null;
  overlayRef: OverlayRef | null;
  /** The live overlay's anchor (null = floated); doubles as "ever anchored". */
  target: HTMLElement | null;
  /** The anchor's scrolling ancestor, the bound the hint stays inside. */
  scroller: HTMLElement | null;
  /** The mounted popover; its host is the element the clamp shifts. */
  popover: ComponentRef<HintPopoverComponent> | null;
  /** The side CDK resolved — which edge the caret sits on. */
  side: LgOverlaySide | null;
  /** Watches the anchor and the hint for size changes; null while floated. */
  resizeObserver: ResizeObserver | null;
  /** Replaced on every remount; the effect outlives individual overlays. */
  subscriptions: Subscription;
  /** The pending first measurement, cancelled if the hint goes first. */
  firstMeasure: AfterRenderRef | null;
}

/**
 * Fires the just-in-time hints: the first time each trigger fires, a small
 * dismissible popover — unless tips are off, a tutorial is running, the hint
 * was already seen, or its platform/completion gate excludes it. At most one
 * shows at a time; a trigger firing while one is up is dropped. Instantiated
 * for its side effects.
 *
 * An open hint stays anchored reactively: a per-hint effect re-resolves its
 * target from {@link OnboardingTargetRegistry}, so the popover follows the
 * element as it enters, leaves or is re-created (floating bottom-centre while
 * there is no target) with no querySelector timing race.
 */
@Injectable({ providedIn: 'root' })
export class HintService {
  private readonly onboarding = inject(OnboardingService);
  private readonly overlayService = inject(LgOverlayService);
  private readonly injector = inject(Injector);
  private readonly workMode = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly translation = inject(TranslationService);
  private readonly logging = inject(LoggingService);
  private readonly registry = inject(OnboardingTargetRegistry);
  private readonly documentation = inject(DocumentationService);
  private readonly scrollDispatcher = inject(ScrollDispatcher);
  private readonly viewportRuler = inject(ViewportRuler);

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

    // First custom-component editor — points at the Ports panel.
    effect(() => {
      const project = this.projectService.activeProject();
      const editingComponent =
        !!project && this.metadataStore.getMetadata(project)?.type === 'comp';
      untracked(() => {
        if (editingComponent) {
          this.fire(hintForTrigger({ kind: 'componentEditor' }));
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
    // A tool switch clears a showing tool hint. Hints triggered by anything
    // else survive it: picking a tool is often the very thing they ask for, and
    // a hint shows once, so clearing one would cut it off mid-read for good.
    if (this.session?.hint.trigger.kind === 'workMode') this.dismiss();
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

  /** Opens a hint, kept anchored as its target comes and goes. */
  private open(hint: Hint): void {
    const session: HintSession = {
      hint,
      effectRef: null,
      overlayRef: null,
      target: null,
      scroller: null,
      popover: null,
      side: null,
      resizeObserver: null,
      subscriptions: new Subscription(),
      firstMeasure: null
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
   * (Re)builds the overlay, swapping between an anchored (connected, with
   * caret) and a floated (bottom-centre) placement; a no-op when the anchor is
   * unchanged.
   *
   * Floating is for a target that has not appeared *yet*. A target that leaves
   * after the hint anchored to it means its surface is gone, so the hint goes
   * with it — deferred and re-checked, since a merely re-created anchor
   * unregisters and registers again and that flicker must not take it down.
   */
  private mount(
    session: HintSession,
    target: HTMLElement | null,
    platform: OnboardingPlatform
  ): void {
    if (!target && session.target) {
      queueMicrotask(() => {
        if (this.session !== session) return;
        const current = this.resolveTarget(session.hint, platform);
        // The effect has already run for this change, so a re-created anchor
        // gets no second notification — re-mount here instead.
        if (current) this.mount(session, current, platform);
        else this.dismiss();
      });
      return;
    }
    if (session.overlayRef && target === session.target) return;
    session.target = target;
    session.scroller = target ? this.scrollerOf(target) : null;
    this.teardownOverlay(session);

    if (target) {
      const side = session.hint.side?.[platform];
      session.overlayRef = this.overlayService.connected({
        origin: target,
        // The popover sizes itself; a CDK-measured flexible box goes stale once
        // the anchor has scrolled out of view and back.
        flexibleDimensions: false,
        // A declared side is a demand, not a preference: it is chosen against
        // what surrounds the anchor, so a flip would land the hint beside
        // something else entirely — pinned, it rides the anchor out of view
        // instead. Hints on the default side keep the fallbacks: they anchor to
        // chrome at the screen edge, where flipping is the point.
        positions: side ? [positionForSide(side)] : connectedPositions('bottom')
      });
    } else {
      // No anchor: float bottom-centre, clear of the bottom chrome — lifted
      // higher on compact where the tool/sim bars occupy that edge.
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
    // A hint counts as seen the moment it is served, so an overlay cdk disposed
    // on navigation is dismissed like one whose anchor went away. Keeping the
    // dead ref would skip the re-mount for the same target and leave the
    // keydown listener behind.
    session.subscriptions.add(
      externalTeardown(session.overlayRef, () => {
        session.overlayRef = null;
        this.dismiss();
      })
    );
    session.subscriptions.add(
      cmp.instance.disableTips.subscribe(() => {
        this.dismiss();
        this.onboarding.disableAllTips();
      })
    );
    const docsPage = session.hint.docsPage;
    if (docsPage) {
      cmp.setInput('hasDocsLink', true);
      session.subscriptions.add(
        cmp.instance.learnMore.subscribe(() => {
          this.dismiss();
          this.documentation.open(docsPage);
        })
      );
    }
    if (target) {
      session.popover = cmp;
      // Point the caret from whichever side CDK actually placed the hint on.
      session.subscriptions.add(
        caretSideChanges(session.overlayRef).subscribe((side) => {
          session.side = side;
          cmp.setInput('side', side);
          this.refresh(session);
        })
      );
      // Hide the hint while its anchor is scrolled out of its container, rather
      // than dismiss it — a hint is spent once dismissed, and scrolling past it
      // is not the user saying they read it. `visibility` rather than a detach
      // keeps its place in the position strategy and stops it being
      // hit-testable meanwhile, children included.
      const pane = session.overlayRef.overlayElement;
      session.subscriptions.add(
        originVisibilityChanges(session.overlayRef).subscribe((visibility) => {
          pane.style.visibility = visibility.isOriginOutsideView
            ? 'hidden'
            : '';
        })
      );
      // Re-measure off the scroll stream, not `positionChanges`: with a single
      // fixed position CDK only emits on a visibility flip, so most repositions
      // pass silently. `ancestorScrolled` is what its own reposition strategy
      // listens to, and subscribing after attach means CDK has already moved
      // the pane by the time this runs.
      session.subscriptions.add(
        this.scrollDispatcher
          .ancestorScrolled(target, 0)
          .subscribe(() => this.refresh(session))
      );
      // Everything that moves the anchor *without* a scroll: a resize, a
      // rotation, or the anchor or hint changing size. CDK repositions on
      // scroll alone, so these have to drive it by hand.
      session.subscriptions.add(
        this.viewportRuler.change().subscribe(() => this.refresh(session, true))
      );
      const observer = new ResizeObserver(() => this.refresh(session, true));
      observer.observe(target);
      observer.observe(cmp.location.nativeElement as HTMLElement);
      session.resizeObserver = observer;
      // Wait for the render that gives the popover its size: measured empty,
      // the pane reads as overflowing the scroller and its centre is
      // meaningless.
      session.firstMeasure = afterNextRender(() => this.refresh(session), {
        injector: this.injector
      });
    }
    document.addEventListener('keydown', this.onKeydown, true);
  }

  /**
   * Re-measures the open hint against its anchor: one read phase, then one
   * write phase for both the scroller clamp and the caret offset. The caret is
   * aimed at where the clamp puts the panel, which re-measuring after the write
   * could not see — the shift is a transform on a descendant, so the pane's own
   * box, which is what CDK reads, never moves.
   *
   * `reposition` first re-runs CDK's own pass, needed whenever the anchor moved
   * for a reason CDK does not watch, and skipped on the scroll path where its
   * strategy has already run.
   */
  private refresh(session: HintSession, reposition = false): void {
    if (reposition) session.overlayRef?.updatePosition();
    const pane = session.overlayRef?.overlayElement;
    const { popover, scroller, target, side } = session;
    if (!pane || !popover) return;

    const panel = pane.getBoundingClientRect();
    const bounds = scroller?.getBoundingClientRect();
    const anchor = target?.getBoundingClientRect();

    // CDK pushes an overflowing overlay back into the *viewport*, which for an
    // anchor in the side bar rides the hint up over the top bars. The container
    // is the real boundary, so the overshoot is taken back here.
    let shift = 0;
    if (bounds) {
      if (panel.top < bounds.top) {
        shift = bounds.top - panel.top;
      } else if (panel.bottom > bounds.bottom) {
        // Never past the top edge: a hint taller than its scroller would
        // otherwise trade an overhang at the bottom for one at the top.
        shift = Math.max(bounds.bottom - panel.bottom, bounds.top - panel.top);
      }
    }

    // Applied to the popover host, not the pane: CDK measures the pane to
    // decide its push, so shifting the pane feeds back and the two oscillate.
    const content = popover.location.nativeElement as HTMLElement;
    content.style.transform = shift === 0 ? '' : `translateY(${shift}px)`;

    if (anchor && side) {
      const drawn = shiftRect(panel, shift);
      popover.setInput('caretOffset', caretOffsetFor(anchor, drawn, side));
    }
  }

  /**
   * The innermost scrolling ancestor of `element` — the bound the hint stays
   * inside. CDK's registered `cdkScrollable`s rather than a walk over computed
   * `overflow`: those are the only scrollers whose movement this service is
   * told about, so clamping against any other would bind the hint to something
   * it never sees move. A scroller a hint must respect needs `cdkScrollable`.
   */
  private scrollerOf(element: HTMLElement): HTMLElement | null {
    let innermost: HTMLElement | null = null;
    // Registration order, not DOM order — pick the one all the others contain.
    for (const scrollable of this.scrollDispatcher.getAncestorScrollContainers(
      element
    )) {
      const candidate = scrollable.getElementRef().nativeElement;
      if (!innermost || innermost.contains(candidate)) innermost = candidate;
    }
    return innermost;
  }

  /** Disposes the overlay instance and its listeners, keeping the effect. */
  private teardownOverlay(session: HintSession): void {
    document.removeEventListener('keydown', this.onKeydown, true);
    session.subscriptions.unsubscribe();
    session.subscriptions = new Subscription();
    session.resizeObserver?.disconnect();
    session.resizeObserver = null;
    session.firstMeasure?.destroy();
    session.firstMeasure = null;
    session.overlayRef?.dispose();
    session.overlayRef = null;
    // Owned by the disposed overlay; the next mount re-establishes them.
    session.popover = null;
    session.side = null;
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
