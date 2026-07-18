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
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';

function popover(): Element | null {
  return document.querySelector('.cdk-overlay-container app-hint-popover');
}

/** A global (bottom-centre float) overlay sits in a global wrapper; an anchored
 *  (connected) one does not — this distinguishes the two placements. */
function isFloating(): boolean {
  return !!popover()?.closest('.cdk-global-overlay-wrapper');
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
        useValue: { mainProject: () => ({ componentCount: 0 }) }
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

  // A hint's target can enter the DOM only after its trigger fires (e.g. the
  // sim controls on entering simulation). Resolution reads the reactive target
  // registry, so it anchors once the element is registered instead of floating.
  it('anchors a hint to its target element when the target is registered', () => {
    const wire = document.createElement('div');
    document.body.appendChild(wire);
    TestBed.inject(OnboardingTargetRegistry).register('tool-wire', wire);

    enterWireTool();

    expect(popover()).not.toBeNull();
    expect(isFloating()).toBe(false); // anchored to the target, not floated

    wire.remove();
  });

  it('floats a hint bottom-centre when its target is not registered', () => {
    enterWireTool(); // no tool-wire registered

    expect(popover()).not.toBeNull();
    expect(isFloating()).toBe(true);
  });

  it('re-anchors a floating hint once its target registers later', () => {
    enterWireTool(); // target not registered yet → floats
    expect(isFloating()).toBe(true);

    // The target appears later (e.g. the sim controls on entering simulation).
    const wire = document.createElement('div');
    document.body.appendChild(wire);
    TestBed.inject(OnboardingTargetRegistry).register('tool-wire', wire);
    tick(); // the per-hint effect re-runs on the registry change

    expect(isFloating()).toBe(false); // now anchored to the element
    wire.remove();
  });

  it('dismisses on Escape', () => {
    enterWireTool();
    expect(popover()).not.toBeNull();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(popover()).toBeNull();
  });

  it('turns off all tips from the hint and closes it', () => {
    enterWireTool();
    const turnOff = document.querySelector<HTMLButtonElement>(
      '.cdk-overlay-container app-hint-popover button'
    );
    turnOff?.click();
    expect(onboarding.tipsEnabled()).toBe(false);
    expect(popover()).toBeNull();
  });
});
