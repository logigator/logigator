import { WorkMode } from '../../work-mode/work-mode.enum';
import { Hint } from '../hint.model';

const wireTool = '[data-onboard="tool-wire"]';
const scissorToggle = '[data-onboard="scissor-toggle"]';
const eraseTool = '[data-onboard="tool-erase"]';
const simControls = '[data-onboard="sim-controls"]';

/**
 * The Tier-1 just-in-time hints — the non-obvious behaviours the flagship
 * tutorial doesn't teach. Each fires once, on the first occurrence of its
 * trigger. See `plans/onboarding.md`.
 */
export const HINTS: readonly Hint[] = [
  {
    id: 'wire-tap-actions',
    trigger: { kind: 'workMode', mode: WorkMode.WIRE_TOOL },
    target: { desktop: wireTool, compact: wireTool },
    text: 'onboarding.hints.wireTapActions'
  },
  {
    id: 'scissor-select',
    trigger: { kind: 'workMode', mode: WorkMode.SELECT_EXACT },
    target: { desktop: scissorToggle, compact: scissorToggle },
    text: {
      desktop: 'onboarding.hints.scissorSelectDesktop',
      compact: 'onboarding.hints.scissorSelectCompact'
    }
  },
  {
    id: 'eraser',
    trigger: { kind: 'workMode', mode: WorkMode.ERASE },
    target: { desktop: eraseTool, compact: eraseTool },
    text: 'onboarding.hints.eraser'
  },
  {
    id: 'sim-controls',
    trigger: { kind: 'workMode', mode: WorkMode.SIMULATION },
    target: { desktop: simControls, compact: simControls },
    text: 'onboarding.hints.simControls'
  },
  {
    id: 'inspect-component',
    trigger: { kind: 'inspect' },
    text: 'onboarding.hints.inspect'
  },
  {
    id: 'pan-zoom-compact',
    trigger: { kind: 'compactEmpty' },
    platforms: ['compact'],
    text: 'onboarding.hints.panZoomCompact',
    suppressIfCompleted: 'getting-started'
  }
];
