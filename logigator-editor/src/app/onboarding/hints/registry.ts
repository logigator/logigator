import { WorkMode } from '../../work-mode/work-mode.enum';
import { Hint, HintTrigger } from '../hint.model';

// Onboarding target ids (see OnboardingTargetRegistry / OnboardTargetDirective).
const wireTool = 'tool-wire';
const scissorToggle = 'scissor-toggle';
const eraseTool = 'tool-erase';
const simControls = 'sim-controls';
const selectionRotate = 'selection-rotate';
const portsPanel = 'ports-panel';
const mobilePorts = 'mobile-ports';

/**
 * The just-in-time hints: the non-obvious behaviours the flagship tutorial does
 * not teach. Each fires once, on the first occurrence of its trigger.
 */
export const HINTS: readonly Hint[] = [
  {
    id: 'wire-tap-actions',
    trigger: { kind: 'workMode', mode: WorkMode.WIRE_TOOL },
    target: { desktop: wireTool, compact: wireTool },
    text: 'onboarding.hints.wireTapActions',
    docs: { page: 'wires-and-connections' }
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
    text: 'onboarding.hints.simControls',
    docs: { page: 'simulation', anchor: 'run-controls' }
  },
  {
    id: 'wire-conflict',
    // Floats: the conflict is somewhere on the board, which no target names.
    trigger: { kind: 'wireConflict' },
    text: 'onboarding.hints.wireConflict',
    docs: { page: 'simulation', anchor: 'conflicting-signals' }
  },
  {
    id: 'selection-actions',
    trigger: { kind: 'select' },
    // Desktop-only: the payload is keyboard shortcuts, and arrow-key move has
    // no button at all.
    platforms: ['desktop'],
    target: { desktop: selectionRotate },
    text: 'onboarding.hints.selectionActions'
  },
  {
    id: 'paste-placement',
    trigger: { kind: 'paste' },
    text: {
      desktop: 'onboarding.hints.pastePlacementDesktop',
      compact: 'onboarding.hints.pastePlacementCompact'
    },
    docs: { page: 'board-and-tools', anchor: 'copy-paste-and-delete' }
  },
  {
    id: 'ports-panel',
    trigger: { kind: 'componentEditor' },
    // Compact points at the HUD button, since there the panel exists only
    // inside its drawer.
    target: { desktop: portsPanel, compact: mobilePorts },
    // Beside the panel, over the board: below it the hint would cover the
    // palette it points past. Above the button on compact, where the HUD owns
    // that edge.
    side: { desktop: 'right', compact: 'top' },
    text: {
      desktop: 'onboarding.hints.portsPanelDesktop',
      compact: 'onboarding.hints.portsPanelCompact'
    },
    docs: { page: 'custom-components', anchor: 'ports' }
  },
  {
    id: 'pan-zoom-compact',
    trigger: { kind: 'compactEmpty' },
    platforms: ['compact'],
    text: 'onboarding.hints.panZoomCompact',
    suppressIfCompleted: 'getting-started'
  }
];

/** The hint wired to `trigger`, if any. */
export function hintForTrigger(trigger: HintTrigger): Hint | undefined {
  return HINTS.find((candidate) =>
    candidate.trigger.kind === 'workMode' && trigger.kind === 'workMode'
      ? candidate.trigger.mode === trigger.mode
      : candidate.trigger.kind === trigger.kind
  );
}
