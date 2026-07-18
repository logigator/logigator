import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ChangelogService } from '../changelog/changelog.service';
import {
  GETTING_STARTED_TUTORIAL,
  OnboardingService
} from './onboarding.service';

const KEYS = [
  'onboarding.tips-enabled',
  'onboarding.completed-tutorials',
  'onboarding.seen-hints'
];

describe('OnboardingService', () => {
  let returning: boolean;

  function makeService(): OnboardingService {
    configureTestBed([
      {
        provide: ChangelogService,
        useValue: { isReturningLegacyUser: () => returning }
      }
    ]);
    return TestBed.inject(OnboardingService);
  }

  beforeEach(() => {
    returning = false;
    for (const key of KEYS) localStorage.removeItem(key);
  });

  afterEach(() => {
    for (const key of KEYS) localStorage.removeItem(key);
  });

  it('defaults tips to enabled and persists the flag across instances', () => {
    const service = makeService();
    expect(service.isTipsEnabled()).toBe(true);

    service.setTipsEnabled(false);
    TestBed.resetTestingModule();
    expect(makeService().isTipsEnabled()).toBe(false);
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

  it('showTipsAgain re-enables tips and clears seen hints but not completions', () => {
    const service = makeService();
    service.startTutorial(GETTING_STARTED_TUTORIAL);
    service.endTutorial(true);
    service.markHintSeen('eraser');
    service.setTipsEnabled(false);

    service.showTipsAgain();

    expect(service.isTipsEnabled()).toBe(true);
    expect(service.hasSeenHint('eraser')).toBe(false);
    expect(service.hasCompletedTutorial(GETTING_STARTED_TUTORIAL)).toBe(true);
  });

  describe('maybeAutoStart', () => {
    const ok = { changelogOpened: false, projectEmpty: true };

    it('starts the getting-started tutorial for a genuinely new user', () => {
      const service = makeService();
      service.maybeAutoStart(ok);
      expect(service.activeTutorial()).toBe(GETTING_STARTED_TUTORIAL);
    });

    it('does not start when the changelog dialog opened this load', () => {
      const service = makeService();
      service.maybeAutoStart({ ...ok, changelogOpened: true });
      expect(service.activeTutorial()).toBeNull();
    });

    it('does not start when there is a non-empty project to preserve', () => {
      const service = makeService();
      service.maybeAutoStart({ ...ok, projectEmpty: false });
      expect(service.activeTutorial()).toBeNull();
    });

    it('does not start for a returning legacy user', () => {
      returning = true;
      const service = makeService();
      service.maybeAutoStart(ok);
      expect(service.activeTutorial()).toBeNull();
    });

    it('does not start once the tutorial has been completed', () => {
      const service = makeService();
      service.startTutorial(GETTING_STARTED_TUTORIAL);
      service.endTutorial(true);
      service.maybeAutoStart(ok);
      expect(service.activeTutorial()).toBeNull();
    });

    it('does not start when tips are disabled', () => {
      const service = makeService();
      service.setTipsEnabled(false);
      service.maybeAutoStart(ok);
      expect(service.activeTutorial()).toBeNull();
    });
  });
});
