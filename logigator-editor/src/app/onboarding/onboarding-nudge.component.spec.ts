import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ProjectService } from '../project/project.service';
import { OnboardingService } from './onboarding.service';
import { OnboardingNudgeComponent } from './onboarding-nudge.component';

const NUDGE_DISMISSED_KEY = 'onboarding.nudge-dismissed';

describe('OnboardingNudgeComponent', () => {
  let fixture: ComponentFixture<OnboardingNudgeComponent>;
  let onboarding: OnboardingService;

  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button'));

  beforeEach(async () => {
    localStorage.clear();
    // A non-empty project proves the nudge no longer gates on canvas contents.
    const project = { components: [{}] };

    configureTestBed(
      [
        {
          provide: ProjectService,
          useValue: { mainProject: () => project, activeProject: () => project }
        }
      ],
      [OnboardingNudgeComponent]
    );
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');

    onboarding = TestBed.inject(OnboardingService);
    fixture = TestBed.createComponent(OnboardingNudgeComponent);
    fixture.detectChanges();
  });

  afterEach(() => localStorage.clear());

  it('shows for a first-time user regardless of canvas contents', () => {
    expect(buttons().length).toBe(2); // start + dismiss
  });

  it('hides once dismissed', () => {
    buttons()[1].click(); // dismiss (X)
    fixture.detectChanges();
    expect(buttons().length).toBe(0);
    expect(localStorage.getItem(NUDGE_DISMISSED_KEY)).toBe('true');
  });

  it('starts the tutorial and retires itself from the Start button', () => {
    buttons()[0].click();
    fixture.detectChanges();
    expect(onboarding.activeTutorial()).toBe('getting-started');
    expect(onboarding.isNudgeDismissed()).toBe(true);
  });

  it('is hidden while a tutorial is running', () => {
    onboarding.startTutorial('getting-started');
    fixture.detectChanges();
    expect(buttons().length).toBe(0);
    onboarding.skipCurrent();
  });

  it('is hidden when tips are turned off', () => {
    onboarding.setTipsEnabled(false);
    fixture.detectChanges();
    expect(buttons().length).toBe(0);
  });
});
