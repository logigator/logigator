import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Component } from '../components/component';
import { ProjectService } from '../project/project.service';
import { OnboardingService } from './onboarding.service';
import { OnboardingNudgeComponent } from './onboarding-nudge.component';

describe('OnboardingNudgeComponent', () => {
  let fixture: ComponentFixture<OnboardingNudgeComponent>;
  let onboarding: OnboardingService;
  let components: Component[];
  let actionChange$: Subject<void>;

  const buttons = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button'));

  beforeEach(async () => {
    localStorage.clear();
    components = [];
    actionChange$ = new Subject<void>();
    const project = { components, actionManager: { actionChange$ } };

    configureTestBed(
      [{ provide: ProjectService, useValue: { mainProject: () => project } }],
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

  it('shows on an empty board and hides once something is placed', () => {
    expect(buttons().length).toBe(2); // start + dismiss

    components.push({} as unknown as Component);
    actionChange$.next();
    fixture.detectChanges();
    expect(buttons().length).toBe(0);
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

  it('starts the getting-started tutorial from the Start button', () => {
    buttons()[0].click();
    expect(onboarding.activeTutorial()).toBe('getting-started');
  });
});
