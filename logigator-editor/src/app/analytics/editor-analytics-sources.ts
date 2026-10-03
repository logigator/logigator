import { effect, inject, Injector, Provider, untracked } from '@angular/core';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import {
  SimulationService,
  SimulationState
} from '../simulation/simulation.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ProjectService } from '../project/project.service';
import { Project } from '../project/project';
import { ANALYTICS_SOURCES, AnalyticsService } from './analytics.service';
import { AnalyticsEvent, operationProperties } from './analytics.mapping';

/**
 * Wires the editor's observable event sources — tool changes, simulation
 * sessions, tutorials and recorded operations — into the analytics sink.
 *
 * Registered through {@link ANALYTICS_SOURCES}, so they start with
 * {@link AnalyticsService.init} and a spec stubbing the sink stubs them too.
 * Kept out of the service's module on purpose: the sink is imported by
 * leaf services (toasts, logging), and importing these sources there would
 * put the whole component registry behind every toast. That made a module
 * cycle (`rom.config` → its option's hex editor → toast → analytics → work
 * mode → component provider → `rom.config`) that broke whichever entry point
 * reached it from the wrong side.
 */
export function provideEditorAnalyticsSources(): Provider {
  return { provide: ANALYTICS_SOURCES, useValue: [wireEditorSources] };
}

function wireEditorSources(): void {
  const analytics = inject(AnalyticsService);
  const injector = inject(Injector);
  watchWorkMode(analytics, inject(WorkModeService), injector);
  watchSimulation(analytics, inject(SimulationService), injector);
  watchTutorial(analytics, inject(OnboardingService), injector);
  watchActiveProject(analytics, inject(ProjectService), injector);
}

function watchWorkMode(
  analytics: AnalyticsService,
  workMode: WorkModeService,
  injector: Injector
): void {
  let previous = workMode.mode();
  effect(
    () => {
      const mode = workMode.mode();
      const prev = previous;
      previous = mode;
      // SIMULATION is covered by the simulation lifecycle events.
      if (mode === prev || mode === WorkMode.SIMULATION) return;
      analytics.capture(AnalyticsEvent.ToolSelected, { mode });
    },
    { injector }
  );
}

function watchSimulation(
  analytics: AnalyticsService,
  simulation: SimulationService,
  injector: Injector
): void {
  let previous = simulation.state();
  effect(
    () => {
      const state = simulation.state();
      const prev = previous;
      previous = state;
      // Keyed on the session becoming active rather than on `ready`: with
      // auto-start, `ready` and `running` are set in one synchronous block
      // and only the latter is observed. Also keeps pause/play from
      // re-reporting a start.
      if (isActive(state) && !isActive(prev))
        analytics.capture(AnalyticsEvent.SimulationStarted, {
          runMode: untracked(() => simulation.mode())
        });
      else if (state === 'inactive' && prev !== 'inactive')
        analytics.capture(AnalyticsEvent.SimulationStopped);
    },
    { injector }
  );
}

function watchTutorial(
  analytics: AnalyticsService,
  onboarding: OnboardingService,
  injector: Injector
): void {
  let previous = onboarding.activeTutorial();
  effect(
    () => {
      const tutorial = onboarding.activeTutorial();
      const prev = previous;
      previous = tutorial;
      // End (completed vs abandoned) is captured where endTutorial runs,
      // the only place carrying that distinction.
      if (tutorial && tutorial !== prev)
        analytics.capture(AnalyticsEvent.TutorialStarted, { tutorial });
    },
    { injector }
  );
}

function watchActiveProject(
  analytics: AnalyticsService,
  projects: ProjectService,
  injector: Injector
): void {
  // ActionManager is per-project, so re-subscribe on a project change and
  // tear down the previous hook to avoid leaks and double-counting.
  let subscribedProject: Project | null = null;
  let unsubscribeActions: (() => void) | null = null;
  effect(
    () => {
      const project = projects.activeProject();
      if (project === subscribedProject) return;
      unsubscribeActions?.();
      unsubscribeActions = null;
      subscribedProject = project;
      if (!project) return;
      unsubscribeActions = project.actionManager.onBeforeRecord((action) =>
        analytics.capture(
          AnalyticsEvent.EditorOperation,
          operationProperties(action.serialize())
        )
      );
    },
    { injector }
  );
}

/** Whether a simulation session is up — `starting` is not yet a session. */
function isActive(state: SimulationState): boolean {
  return state === 'ready' || state === 'running';
}
