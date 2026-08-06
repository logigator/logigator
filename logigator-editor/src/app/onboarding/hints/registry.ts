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
 * The Tier-1 just-in-time hints — the non-obvious behaviours the flagship
 * tutorial doesn't teach. Each fires once, on the first occurrence of its
 * trigger. See `plans/onboarding.md`.
 */
export const HINTS: readonly Hint[] = [
  {
    id: 'wire-tap-actions',
    trigger: { kind: 'workMode', mode: WorkMode.WIRE_TOOL },
    target: { desktop: wireTool, compact: wireTool },
    text: 'onboarding.hints.wireTapActions',
    docsPage: 'wires-and-connections'
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
    docsPage: 'simulation'
  },
  {
    id: 'selection-actions',
    trigger: { kind: 'select' },
    // The keyboard shortcuts are the payload; the buttons exist only on desktop
    // and arrow-key move has no button at all, so this is desktop-only.
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
    docsPage: 'board-and-tools'
  },
  {
    id: 'ports-panel',
    trigger: { kind: 'componentEditor' },
    // Desktop points at the panel itself; compact at the HUD button that opens
    // it, since there the panel only exists inside its drawer.
    target: { desktop: portsPanel, compact: mobilePorts },
    // Beside the panel, over the board: the side bar is only as wide as the
    // panel, so below it the hint would cover the palette it points past. Above
    // the button on compact — the HUD already sits on the bottom edge.
    side: { desktop: 'right', compact: 'top' },
    text: {
      desktop: 'onboarding.hints.portsPanelDesktop',
      compact: 'onboarding.hints.portsPanelCompact'
    },
    docsPage: 'custom-components'
  },
  {
    id: 'pan-zoom-compact',
    trigger: { kind: 'compactEmpty' },
    platforms: ['compact'],
    text: 'onboarding.hints.panZoomCompact',
    suppressIfCompleted: 'getting-started'
  }
];

/** The hint wired to `trigger`, if any — trigger→hint wiring lives only here. */
export function hintForTrigger(trigger: HintTrigger): Hint | undefined {
  return HINTS.find((candidate) =>
    candidate.trigger.kind === 'workMode' && trigger.kind === 'workMode'
      ? candidate.trigger.mode === trigger.mode
      : candidate.trigger.kind === trigger.kind
  );
}
