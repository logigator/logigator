import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRef, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Subject } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ProjectService } from '../project/project.service';
import { DocumentationService } from '../documentation/documentation.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { Project } from '../project/project';
import {
  ProjectMetadata,
  ProjectMetadataStore
} from '../persistence/project-metadata.store';
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

/** A stand-in for the active project, exposing just the streams HintService taps. */
function makeFakeProject() {
  return {
    componentCount: 0,
    pasteRequest$: new Subject<unknown>(),
    selectionManager: {
      selectionChange$: new Subject<void>(),
      selectedComponents: new Set<unknown>(),
      selectedWires: new Set<unknown>()
    }
  };
}

describe('HintService', () => {
  let workMode: WorkModeService;
  let onboarding: OnboardingService;
  let activeProject: WritableSignal<ReturnType<typeof makeFakeProject> | null>;
  let docsOpen: ReturnType<typeof vi.fn>;

  const tick = () => TestBed.inject(ApplicationRef).tick();
  const enterWireTool = () => {
    workMode.setMode(WorkMode.WIRE_TOOL);
    tick();
  };

  beforeEach(async () => {
    localStorage.clear();
    activeProject = signal<ReturnType<typeof makeFakeProject> | null>(null);
    configureTestBed([
      {
        provide: ProjectService,
        useValue: { mainProject: () => ({ componentCount: 0 }), activeProject }
      },
      {
        provide: DocumentationService,
        useValue: { open: (docsOpen = vi.fn()) }
      }
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

  // Floating is for a target that has not appeared yet. Once the hint has
  // anchored, losing the target means its surface closed (the component tab, the
  // side bar) — floating it on would leave it over the board pointing at nothing.
  it('dismisses an anchored hint once its target leaves the DOM', async () => {
    const registry = TestBed.inject(OnboardingTargetRegistry);
    const wire = document.createElement('div');
    document.body.appendChild(wire);
    registry.register('tool-wire', wire);

    enterWireTool();
    expect(isFloating()).toBe(false);

    registry.unregister('tool-wire', wire);
    wire.remove();
    tick();
    await Promise.resolve(); // the deferred re-check

    expect(popover()).toBeNull();
  });

  // An anchor that is merely re-created (its host re-rendered) unregisters and
  // registers again; the hint has to follow it, not read the loss as a close.
  it('re-anchors an anchored hint to a re-created target', async () => {
    const registry = TestBed.inject(OnboardingTargetRegistry);
    const wire = document.createElement('div');
    document.body.appendChild(wire);
    registry.register('tool-wire', wire);

    enterWireTool();
    expect(isFloating()).toBe(false);

    registry.unregister('tool-wire', wire);
    wire.remove();
    const replacement = document.createElement('div');
    document.body.appendChild(replacement);
    registry.register('tool-wire', replacement);
    tick();
    await Promise.resolve();

    expect(popover()).not.toBeNull();
    expect(isFloating()).toBe(false);
    replacement.remove();
  });

  it('shows the selection hint only once two or more elements are selected', () => {
    const project = makeFakeProject();
    activeProject.set(project);
    tick();

    // A single-element selection is below the threshold — no hint yet.
    project.selectionManager.selectedComponents.add({});
    project.selectionManager.selectionChange$.next();
    tick();
    expect(popover()).toBeNull();

    // A second element crosses the threshold.
    project.selectionManager.selectedWires.add({});
    project.selectionManager.selectionChange$.next();
    tick();
    expect(popover()).not.toBeNull();
    expect(onboarding.hasSeenHint('selection-actions')).toBe(true);
  });

  it('shows the ports hint when a custom-component editor becomes active', () => {
    const project = makeFakeProject();
    TestBed.inject(ProjectMetadataStore).register(
      project as unknown as Project,
      { type: 'comp' } as ProjectMetadata,
      false // no action manager on the fake project to track
    );
    activeProject.set(project);
    tick();

    expect(popover()).not.toBeNull();
    expect(onboarding.hasSeenHint('ports-panel')).toBe(true);
  });

  // Picking a tool is what several non-tool hints ask for — the Ports hint asks
  // for a plug, which arms COMPONENT_PLACEMENT. Only tool hints clear on a mode
  // change, or following the instruction would close the hint giving it.
  it('keeps a non-tool hint open across a work-mode change', () => {
    const project = makeFakeProject();
    TestBed.inject(ProjectMetadataStore).register(
      project as unknown as Project,
      { type: 'comp' } as ProjectMetadata,
      false
    );
    activeProject.set(project);
    tick();
    expect(popover()).not.toBeNull();

    enterWireTool();

    expect(popover()).not.toBeNull();
    // The tool hint is dropped rather than consumed, so it can still fire later.
    expect(onboarding.hasSeenHint('wire-tap-actions')).toBe(false);
  });

  it('does not show the ports hint for a plain project', () => {
    const project = makeFakeProject();
    TestBed.inject(ProjectMetadataStore).register(
      project as unknown as Project,
      { type: 'project' } as ProjectMetadata,
      false
    );
    activeProject.set(project);
    tick();

    expect(onboarding.hasSeenHint('ports-panel')).toBe(false);
  });

  it('shows the paste hint on the first paste', () => {
    const project = makeFakeProject();
    activeProject.set(project);
    tick();

    project.pasteRequest$.next({});
    tick();
    expect(popover()).not.toBeNull();
    expect(onboarding.hasSeenHint('paste-placement')).toBe(true);
  });

  it('opens the linked documentation page from the learn-more action', () => {
    enterWireTool();
    const learnMore = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.cdk-overlay-container app-hint-popover button'
      )
    ).find((button) => button.textContent?.includes('Learn more'));
    expect(learnMore).toBeDefined();

    learnMore!.click();
    tick();
    expect(docsOpen).toHaveBeenCalledWith('wires-and-connections');
    expect(popover()).toBeNull();
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
    const turnOff = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '.cdk-overlay-container app-hint-popover button'
      )
    ).find((button) => button.textContent?.includes('Turn off all tips'));
    turnOff?.click();
    expect(onboarding.tipsEnabled()).toBe(false);
    expect(popover()).toBeNull();
  });
});
