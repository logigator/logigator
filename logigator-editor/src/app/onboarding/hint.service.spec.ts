import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ProjectService } from '../project/project.service';
import { InspectionService } from '../inspection/inspection.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { OnboardingService } from './onboarding.service';
import { HintService } from './hint.service';

function popover(): Element | null {
  return document.querySelector('.cdk-overlay-container app-hint-popover');
}

describe('HintService', () => {
  let workMode: WorkModeService;
  let onboarding: OnboardingService;

  const tick = () => TestBed.inject(ApplicationRef).tick();
  const enterWireTool = () => {
    workMode.setMode(WorkMode.WIRE_TOOL);
    tick();
  };

  beforeEach(async () => {
    localStorage.clear();
    configureTestBed([
      {
        provide: ProjectService,
        useValue: { mainProject: () => ({ components: [] }) }
      },
      { provide: InspectionService, useValue: { open: signal(null) } }
    ]);
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');

    TestBed.inject(HintService); // subscribes to triggers
    workMode = TestBed.inject(WorkModeService);
    onboarding = TestBed.inject(OnboardingService);
    tick();
  });

  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.remove();
    localStorage.clear();
  });

  it('shows the wire hint on first wire-tool entry and marks it seen', () => {
    enterWireTool();
    expect(popover()).not.toBeNull();
    expect(onboarding.hasSeenHint('wire-tap-actions')).toBe(true);
  });

  it('does not show a hint twice', () => {
    enterWireTool();
    workMode.setMode(WorkMode.PAN); // dismisses the showing hint
    tick();
    expect(popover()).toBeNull();

    enterWireTool(); // already seen
    expect(popover()).toBeNull();
  });

  it('is suppressed while a tutorial is running', () => {
    onboarding.startTutorial('getting-started');
    enterWireTool();
    expect(popover()).toBeNull();
    expect(onboarding.hasSeenHint('wire-tap-actions')).toBe(false);
    onboarding.skipCurrent();
  });

  it('is suppressed when tips are turned off', () => {
    onboarding.setTipsEnabled(false);
    enterWireTool();
    expect(popover()).toBeNull();
    expect(onboarding.hasSeenHint('wire-tap-actions')).toBe(false);
  });

  it('dismisses on Escape', () => {
    enterWireTool();
    expect(popover()).not.toBeNull();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(popover()).toBeNull();
  });
});
