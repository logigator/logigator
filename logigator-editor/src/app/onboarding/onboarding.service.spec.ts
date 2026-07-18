import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  GETTING_STARTED_TUTORIAL,
  OnboardingService
} from './onboarding.service';

const KEYS = [
  'onboarding.tips-enabled',
  'onboarding.completed-tutorials',
  'onboarding.seen-hints',
  'onboarding.nudge-dismissed'
];

describe('OnboardingService', () => {
  function makeService(): OnboardingService {
    configureTestBed();
    return TestBed.inject(OnboardingService);
  }

  beforeEach(() => {
    for (const key of KEYS) localStorage.removeItem(key);
  });

  afterEach(() => {
    for (const key of KEYS) localStorage.removeItem(key);
  });

  it('defaults tips to enabled and persists the flag across instances', () => {
    const service = makeService();
    expect(service.tipsEnabled()).toBe(true);

    service.setTipsEnabled(false);
    TestBed.resetTestingModule();
    expect(makeService().tipsEnabled()).toBe(false);
  });

  it('remembers completed tutorials and seen hints across instances', () => {
    const service = makeService();
    service.startTutorial(GETTING_STARTED_TUTORIAL);
    service.endTutorial(true);
    service.markHintSeen('wire-tap-actions');

    TestBed.resetTestingModule();
    const reloaded = makeService();
    expect(reloaded.hasCompletedTutorial(GETTING_STARTED_TUTORIAL)).toBe(true);
    expect(reloaded.hasSeenHint('wire-tap-actions')).toBe(true);
  });

  it('skip ends the tutorial without recording completion', () => {
    const service = makeService();
    service.startTutorial(GETTING_STARTED_TUTORIAL);
    service.skipCurrent();

    expect(service.activeTutorial()).toBeNull();
    expect(service.hasCompletedTutorial(GETTING_STARTED_TUTORIAL)).toBe(false);
  });

  it('turning tips off ends a running tutorial but keeps it resumable', () => {
    const service = makeService();
    service.startTutorial(GETTING_STARTED_TUTORIAL);
    service.setTipsEnabled(false);

    expect(service.activeTutorial()).toBeNull();
    expect(service.hasCompletedTutorial(GETTING_STARTED_TUTORIAL)).toBe(false);
  });

  it('showTipsAgain re-enables tips and clears seen hints and completions', () => {
    const service = makeService();
    service.startTutorial(GETTING_STARTED_TUTORIAL);
    service.endTutorial(true);
    service.markHintSeen('eraser');
    service.setTipsEnabled(false);

    service.showTipsAgain();

    expect(service.tipsEnabled()).toBe(true);
    expect(service.hasSeenHint('eraser')).toBe(false);
    expect(service.hasCompletedTutorial(GETTING_STARTED_TUTORIAL)).toBe(false);
  });

  describe('nudge dismissal', () => {
    it('defaults to shown and persists dismissal across instances', () => {
      const service = makeService();
      expect(service.nudgeDismissed()).toBe(false);

      service.dismissNudge();
      TestBed.resetTestingModule();
      expect(makeService().nudgeDismissed()).toBe(true);
    });

    it('is restored by showTipsAgain', () => {
      const service = makeService();
      service.dismissNudge();
      service.showTipsAgain();
      expect(service.nudgeDismissed()).toBe(false);
    });
  });
});
