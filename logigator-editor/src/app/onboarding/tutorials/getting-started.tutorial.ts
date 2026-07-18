import { BuiltInComponentType } from '../../components/component-type.enum';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { TutorialDefinition } from '../tutorial.model';
import {
  ledPowered,
  netComplete,
  placedSince,
  placedTotalSince
} from './detectors';

const SW = BuiltInComponentType.SWITCH;
const AND = BuiltInComponentType.AND;
const LED = BuiltInComponentType.LED;

// Onboarding target ids (see OnboardingTargetRegistry / OnboardTargetDirective).
const paletteItem = (type: number): string => `palette-item-${type}`;
const TOOL_WIRE = 'tool-wire';
const SIM_START = 'sim-start';
const MOBILE_COMPONENTS = 'mobile-components';

/**
 * The flagship first-run tutorial: build two Switches → AND → LED, run it, and
 * flip the switches to see the LED light. Authored for desktop and compact;
 * step ordering and detection follow `plans/onboarding.md`. Step 3 is
 * compact-only (desktop keeps the component list always visible).
 */
export const gettingStartedTutorial: TutorialDefinition = {
  id: 'getting-started',
  steps: [
    {
      id: 'welcome',
      title: 'onboarding.tutorials.gettingStarted.steps.welcome.title',
      text: 'onboarding.tutorials.gettingStarted.steps.welcome.text',
      placement: 'center',
      advanceOn: { kind: 'manual' }
    },
    {
      id: 'moveAround',
      title: 'onboarding.tutorials.gettingStarted.steps.moveAround.title',
      text: {
        desktop:
          'onboarding.tutorials.gettingStarted.steps.moveAround.textDesktop',
        compact:
          'onboarding.tutorials.gettingStarted.steps.moveAround.textCompact'
      },
      placement: 'center',
      advanceOn: { kind: 'manual' }
    },
    {
      id: 'openComponents',
      title: 'onboarding.tutorials.gettingStarted.steps.openComponents.title',
      text: 'onboarding.tutorials.gettingStarted.steps.openComponents.text',
      platforms: ['compact'],
      target: { compact: MOBILE_COMPONENTS },
      placement: 'top',
      advanceOn: { kind: 'manual' }
    },
    {
      id: 'placeAnd',
      title: 'onboarding.tutorials.gettingStarted.steps.placeAnd.title',
      text: {
        desktop:
          'onboarding.tutorials.gettingStarted.steps.placeAnd.textDesktop',
        compact:
          'onboarding.tutorials.gettingStarted.steps.placeAnd.textCompact'
      },
      target: { desktop: paletteItem(AND), compact: paletteItem(AND) },
      advanceOn: {
        kind: 'action',
        predicate: (ctx) => placedSince(ctx, AND) >= 1
      },
      nudge: (ctx) =>
        placedSince(ctx, AND) === 0 && placedTotalSince(ctx) > 0
          ? 'onboarding.tutorials.gettingStarted.steps.placeAnd.nudge'
          : null
    },
    {
      id: 'addSwitches',
      title: 'onboarding.tutorials.gettingStarted.steps.addSwitches.title',
      text: 'onboarding.tutorials.gettingStarted.steps.addSwitches.text',
      target: { desktop: paletteItem(SW), compact: paletteItem(SW) },
      advanceOn: {
        kind: 'action',
        predicate: (ctx) => placedSince(ctx, SW) >= 2
      },
      params: (ctx) => ({ placed: Math.min(placedSince(ctx, SW), 2), total: 2 })
    },
    {
      id: 'addLed',
      title: 'onboarding.tutorials.gettingStarted.steps.addLed.title',
      text: 'onboarding.tutorials.gettingStarted.steps.addLed.text',
      target: { desktop: paletteItem(LED), compact: paletteItem(LED) },
      advanceOn: {
        kind: 'action',
        predicate: (ctx) => placedSince(ctx, LED) >= 1
      }
    },
    {
      id: 'wireUp',
      title: 'onboarding.tutorials.gettingStarted.steps.wireUp.title',
      text: 'onboarding.tutorials.gettingStarted.steps.wireUp.text',
      target: { desktop: TOOL_WIRE, compact: TOOL_WIRE },
      advanceOn: {
        kind: 'action',
        predicate: (ctx) => netComplete(ctx.project)
      }
    },
    {
      id: 'startSim',
      title: 'onboarding.tutorials.gettingStarted.steps.startSim.title',
      text: 'onboarding.tutorials.gettingStarted.steps.startSim.text',
      placement: 'left',
      target: { desktop: SIM_START, compact: SIM_START },
      advanceOn: { kind: 'workMode', mode: WorkMode.SIMULATION }
    },
    {
      id: 'flipSwitch',
      title: 'onboarding.tutorials.gettingStarted.steps.flipSwitch.title',
      text: {
        desktop:
          'onboarding.tutorials.gettingStarted.steps.flipSwitch.textDesktop',
        compact:
          'onboarding.tutorials.gettingStarted.steps.flipSwitch.textCompact'
      },
      placement: 'center',
      advanceOn: {
        kind: 'simFrame',
        predicate: (ctx) => ctx.userInteracted && ledPowered(ctx.sim)
      }
    },
    {
      id: 'complete',
      title: 'onboarding.tutorials.gettingStarted.steps.complete.title',
      text: {
        desktop:
          'onboarding.tutorials.gettingStarted.steps.complete.textDesktop',
        compact:
          'onboarding.tutorials.gettingStarted.steps.complete.textCompact'
      },
      placement: 'center',
      advanceOn: { kind: 'manual' }
    }
  ]
};
