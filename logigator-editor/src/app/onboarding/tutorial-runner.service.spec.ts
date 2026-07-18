import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Component } from '../components/component';
import { BuiltInComponentType } from '../components/component-type.enum';
import { ProjectService } from '../project/project.service';
import { SimulationService } from '../simulation/simulation.service';
import { OnboardingService } from './onboarding.service';
import { OnboardingOverlayService } from './onboarding-overlay.service';
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
      text: 'onboarding.tutorials.gettingStarted.steps.addLed.text',
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

describe('TutorialRunnerService', () => {
  let onboarding: OnboardingService;
  let show: ReturnType<typeof vi.fn>;
  let hide: ReturnType<typeof vi.fn>;
  let components: Component[];
  let actionChange$: Subject<void>;
  let userInput$: Subject<Component>;

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
    const project = {
      components,
      userInput$,
      actionManager: { actionChange$ }
    };

    configureTestBed([
      { provide: ProjectService, useValue: { mainProject: () => project } },
      { provide: OnboardingOverlayService, useValue: { show, hide } },
      { provide: SimulationService, useValue: { frame$: new Subject() } }
    ]);
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');

    TestBed.inject(TutorialRunnerService); // registers the driving effects
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

    lastHandlers().next?.(); // step 1 → 2 (action step)
    tick();
    expect(lastView().stepNumber).toBe(2);
    expect(lastView().showNext).toBe(false);

    placeSwitch(); // predicate satisfied → step 2 → 3
    expect(lastView().stepNumber).toBe(3);
  });

  it('marks the tutorial completed after the last step', () => {
    onboarding.startTutorial('test');
    tick();
    lastHandlers().next?.(); // → 2
    tick();
    placeSwitch(); // → 3
    lastHandlers().next?.(); // → past the end
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
});
