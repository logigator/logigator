import { DocsTarget } from './docs-target';

/**
 * The sections the editor's chrome links to outside the component mapping
 * and the onboarding hints. Kept in one place so one spec checks every anchor
 * against the pages.
 */
export const DOCS_LINKS = {
  simulationWontStart: {
    page: 'simulation',
    anchor: 'when-the-simulation-won-t-start'
  },
  simulationSpeed: { page: 'simulation', anchor: 'speed' },
  clock: { page: 'clock-and-timing', anchor: 'clock' },
  ports: { page: 'custom-components', anchor: 'ports' },
  localDocuments: {
    page: 'cloud',
    anchor: 'local-and-cloud'
  },
  circuitFiles: { page: 'saving-and-files', anchor: 'circuit-files' },
  // The help buttons of the inspection windows and the dialogs.
  romContents: { page: 'inspection', anchor: 'rom-contents' },
  ramContents: { page: 'inspection', anchor: 'ram-contents' },
  terminalOutput: { page: 'inspection', anchor: 'terminal-output' },
  watches: { page: 'inspection', anchor: 'watches' },
  gamepadWindow: { page: 'inputs', anchor: 'gamepad' },
  gamepadKeys: { page: 'shortcuts', anchor: 'gamepad-keys' },
  gamepadButtonNames: { page: 'inputs', anchor: 'button-names' },
  keyboardWindow: { page: 'inputs', anchor: 'the-keyboard-window' },
  romEditor: { page: 'memory', anchor: 'editing-the-contents' },
  shortcutManager: { page: 'shortcuts', anchor: 'changing-a-binding' }
} as const satisfies Record<string, DocsTarget>;
