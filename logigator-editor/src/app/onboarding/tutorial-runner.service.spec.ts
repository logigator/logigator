import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Component } from '../components/component';
import { BuiltInComponentType } from '@logigator/core';
import { ConfirmationService } from '@logigator/ui';
import { ProjectService } from '../project/project.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { SimulationService } from '../simulation/simulation.service';
import { MobileUiService } from '../layout/mobile-ui.service';
import { OnboardingService } from './onboarding.service';
import { OnboardingOverlayService } from './onboarding-overlay.service';
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';
import { CoachMarkHandlers, CoachMarkView } from './coach-mark.model';
import { TutorialRunnerService } from './tutorial-runner.service';
import { TutorialDefinition } from './tutorial.model';
import { placedSince } from './tutorials/detectors';
import { TUTORIALS } from './tutorials/registry';

const SW = BuiltInComponentType.SWITCH;

// Two manual steps around one action step, so the runner mechanics can be
// exercised without depending on the real script's detectors.
const TEST_TUTORIAL: TutorialDefinition = {
  id: 'test',
  steps: [
    {
      id: 'a',
      title: 'onboarding.tutorials.gettingStarted.steps.welcome.title',
      text: 'onboarding.tutorials.gettingStarted.steps.welcome.text',
      advanceOn: { kind: 'manual' }
    },
    {
      id: 'b',
      title: 'onboarding.tutorials.gettingStarted.steps.addSwitches.title',
      text: 'onboarding.tutorials.gettingStarted.steps.addLed.textDesktop',
      advanceOn: {
        kind: 'action',
        predicate: (ctx) => placedSince(ctx, SW) >= 1
      }
    },
    {
      id: 'c',
      title: 'onboarding.tutorials.gettingStarted.steps.startSim.title',
      text: 'onboarding.tutorials.gettingStarted.steps.startSim.text',
      advanceOn: { kind: 'manual' }
    }
  ]
};

interface ConfirmConfig {
  readonly accept: () => void;
  readonly reject: () => void;
}

describe('TutorialRunnerService', () => {
  let runner: TutorialRunnerService;
  let onboarding: OnboardingService;
  let show: ReturnType<typeof vi.fn>;
  let hide: ReturnType<typeof vi.fn>;
  let components: Component[];
  let actionChange$: Subject<void>;
  let userInput$: Subject<Component>;
  let createAndSetEmptyProject: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn<(config: ConfirmConfig) => void>>;
  let dirty: boolean;

  const tick = () => TestBed.inject(ApplicationRef).tick();
  const lastView = (): CoachMarkView => show.mock.calls.at(-1)![1];
  const lastHandlers = (): CoachMarkHandlers => show.mock.calls.at(-1)![2];

  function placeSwitch(): void {
    components.push({ config: { type: SW } } as unknown as Component);
    actionChange$.next();
    tick();
  }

  beforeEach(async () => {
    localStorage.clear();
    show = vi.fn();
    hide = vi.fn();
    components = [];
    actionChange$ = new Subject<void>();
    userInput$ = new Subject<Component>();
    createAndSetEmptyProject = vi.fn();
    confirm = vi.fn<(config: ConfirmConfig) => void>();
    dirty = false;
    const project = {
      components,
      userInput$,
      actionManager: { actionChange$ }
    };

    configureTestBed([
      { provide: ProjectService, useValue: { mainProject: () => project } },
      { provide: OnboardingOverlayService, useValue: { show, hide } },
      { provide: SimulationService, useValue: { frame$: new Subject() } },
      { provide: PersistenceService, useValue: { createAndSetEmptyProject } },
      { provide: ProjectMetadataStore, useValue: { isDirty: () => dirty } },
      { provide: ConfirmationService, useValue: { confirm } }
    ]);
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');

    runner = TestBed.inject(TutorialRunnerService); // registers the driving effects
    onboarding = TestBed.inject(OnboardingService);
    (TUTORIALS as Record<string, TutorialDefinition>)['test'] = TEST_TUTORIAL;
    tick();
  });

  afterEach(() => {
    delete (TUTORIALS as Record<string, TutorialDefinition>)['test'];
    localStorage.clear();
  });

  it('shows the first step with a step counter and Next on manual steps', () => {
    onboarding.startTutorial('test');
    tick();
    const view = lastView();
    expect(view.stepNumber).toBe(1);
    expect(view.totalSteps).toBe(3);
    expect(view.showNext).toBe(true);
  });

  it('does not advance a manual step when a lever/button is driven', () => {
    onboarding.startTutorial('test');
    tick();
    expect(lastView().stepNumber).toBe(1); // manual step

    userInput$.next({} as Component); // drive an input mid-step
    tick();

    expect(lastView().stepNumber).toBe(1); // still waiting on Next
  });

  it('advances manual steps on Next and auto-steps on the action predicate', () => {
    onboarding.startTutorial('test');
    tick();

    lastHandlers().next(); // step 1 → 2 (action step)
    tick();
    expect(lastView().stepNumber).toBe(2);
    expect(lastView().showNext).toBe(false);

    placeSwitch(); // predicate satisfied → step 2 → 3
    expect(lastView().stepNumber).toBe(3);
  });

  it('marks the tutorial completed after the last step', () => {
    onboarding.startTutorial('test');
    tick();
    lastHandlers().next(); // → 2
    tick();
    placeSwitch(); // → 3
    lastHandlers().next(); // → past the end
    tick();

    expect(onboarding.activeTutorial()).toBeNull();
    expect(onboarding.hasCompletedTutorial('test')).toBe(true);
    expect(hide).toHaveBeenCalled();
  });

  it('skip ends the run without marking it completed', () => {
    onboarding.startTutorial('test');
    tick();
    lastHandlers().skip();
    tick();

    expect(onboarding.activeTutorial()).toBeNull();
    expect(onboarding.hasCompletedTutorial('test')).toBe(false);
    expect(hide).toHaveBeenCalled();
  });

  it('re-anchors the current step when its target registers', () => {
    const targeted: TutorialDefinition = {
      id: 'targeted',
      steps: [
        {
          id: 't',
          title: 'onboarding.tutorials.gettingStarted.steps.welcome.title',
          text: 'onboarding.tutorials.gettingStarted.steps.welcome.text',
          target: { desktop: 'anchor-x', compact: 'anchor-x' },
          advanceOn: { kind: 'manual' }
        }
      ]
    };
    (TUTORIALS as Record<string, TutorialDefinition>)['targeted'] = targeted;

    onboarding.startTutorial('targeted');
    tick();
    // Target not registered yet → shown without an anchor.
    expect(show.mock.calls.at(-1)![0]).toBeNull();

    // Attached to the document: only a connected element resolves as an anchor.
    const el = document.createElement('div');
    document.body.appendChild(el);
    TestBed.inject(OnboardingTargetRegistry).register('anchor-x', el);
    tick();
    // The effect re-runs on the registry change and re-anchors.
    expect(show.mock.calls.at(-1)![0]).toBe(el);

    onboarding.skipCurrent();
    el.remove();
    delete (TUTORIALS as Record<string, TutorialDefinition>)['targeted'];
  });

  it('anchors to the first connected candidate, skipping a detached one', () => {
    const candidates: TutorialDefinition = {
      id: 'candidates',
      steps: [
        {
          id: 'c',
          title: 'onboarding.tutorials.gettingStarted.steps.welcome.title',
          text: 'onboarding.tutorials.gettingStarted.steps.welcome.text',
          target: {
            desktop: ['primary', 'fallback'],
            compact: ['primary', 'fallback']
          },
          advanceOn: { kind: 'manual' }
        }
      ]
    };
    (TUTORIALS as Record<string, TutorialDefinition>)['candidates'] =
      candidates;

    // A registered-but-detached top candidate (a closed sheet's palette item)
    // and a connected fallback (the button that opens it).
    const detached = document.createElement('div');
    const fallback = document.createElement('div');
    document.body.appendChild(fallback);
    const reg = TestBed.inject(OnboardingTargetRegistry);
    reg.register('primary', detached);
    reg.register('fallback', fallback);

    onboarding.startTutorial('candidates');
    tick();
    // The detached primary is skipped; the connected fallback wins.
    expect(show.mock.calls.at(-1)![0]).toBe(fallback);

    // The primary attaches without re-registering (a sheet opening its
    // already-registered, projected content); a sheet toggle re-anchors it.
    document.body.appendChild(detached);
    TestBed.inject(MobileUiService).open('palette');
    tick();
    expect(show.mock.calls.at(-1)![0]).toBe(detached);

    onboarding.skipCurrent();
    detached.remove();
    fallback.remove();
    delete (TUTORIALS as Record<string, TutorialDefinition>)['candidates'];
  });

  describe('launch', () => {
    it('on a clean board, swaps in a fresh project and starts without asking', async () => {
      await runner.launch('test');
      tick();

      expect(confirm).not.toHaveBeenCalled();
      expect(createAndSetEmptyProject).toHaveBeenCalledOnce();
      expect(onboarding.activeTutorial()).toBe('test');
      expect(onboarding.nudgeDismissed()).toBe(true);
    });

    it('on a dirty board, asks first and only launches after accept', async () => {
      dirty = true;
      const launched = runner.launch('test');

      expect(createAndSetEmptyProject).not.toHaveBeenCalled();
      expect(onboarding.activeTutorial()).toBeNull();

      confirm.mock.calls[0][0].accept();
      await launched;
      tick();

      expect(createAndSetEmptyProject).toHaveBeenCalledOnce();
      expect(onboarding.activeTutorial()).toBe('test');
    });

    it('on a dirty board, launches nothing when the user cancels', async () => {
      dirty = true;
      const launched = runner.launch('test');

      confirm.mock.calls[0][0].reject();
      await launched;
      tick();

      expect(createAndSetEmptyProject).not.toHaveBeenCalled();
      expect(onboarding.activeTutorial()).toBeNull();
      expect(onboarding.nudgeDismissed()).toBe(false);
    });
  });
});
