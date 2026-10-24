import {
  BuiltInComponentType,
  ComponentType,
  CUSTOM_TYPE_ID_BASE
} from '@logigator/core';
import { DocsTarget } from './docs-target';

/**
 * Where each built-in is documented. A palette component's section sits on
 * the page of its palette category, under the heading its palette name
 * started out as; the rest are explained alongside the feature they serve.
 * Keyed by every type, so a new built-in does not compile without one.
 */
const BUILT_IN_DOCS: Record<BuiltInComponentType, DocsTarget> = {
  [BuiltInComponentType.NOT]: { page: 'logic-gates', anchor: 'not-gate' },
  [BuiltInComponentType.AND]: { page: 'logic-gates', anchor: 'and-gate' },
  [BuiltInComponentType.OR]: { page: 'logic-gates', anchor: 'or-gate' },
  [BuiltInComponentType.XOR]: { page: 'logic-gates', anchor: 'xor-gate' },
  [BuiltInComponentType.HALF_ADDER]: {
    page: 'adders-and-selectors',
    anchor: 'half-adder'
  },
  [BuiltInComponentType.FULL_ADDER]: {
    page: 'adders-and-selectors',
    anchor: 'full-adder'
  },
  [BuiltInComponentType.MUX]: {
    page: 'adders-and-selectors',
    anchor: 'multiplexer'
  },
  [BuiltInComponentType.DEMUX]: {
    page: 'adders-and-selectors',
    anchor: 'demultiplexer'
  },
  [BuiltInComponentType.DECODER]: {
    page: 'adders-and-selectors',
    anchor: 'decoder'
  },
  [BuiltInComponentType.ENCODER]: {
    page: 'adders-and-selectors',
    anchor: 'encoder'
  },
  [BuiltInComponentType.D_FF]: { page: 'memory', anchor: 'd-flip-flop' },
  [BuiltInComponentType.JK_FF]: { page: 'memory', anchor: 'jk-flip-flop' },
  [BuiltInComponentType.SR_FF]: { page: 'memory', anchor: 'sr-flip-flop' },
  [BuiltInComponentType.ROM]: { page: 'memory', anchor: 'rom' },
  [BuiltInComponentType.RAM]: { page: 'memory', anchor: 'ram' },
  [BuiltInComponentType.CLOCK]: { page: 'clock-and-timing', anchor: 'clock' },
  [BuiltInComponentType.DELAY]: { page: 'clock-and-timing', anchor: 'delay' },
  [BuiltInComponentType.RNG]: {
    page: 'clock-and-timing',
    anchor: 'random-number-generator'
  },
  [BuiltInComponentType.SWITCH]: { page: 'inputs', anchor: 'switch' },
  [BuiltInComponentType.BUTTON]: { page: 'inputs', anchor: 'button' },
  [BuiltInComponentType.PULSE_BUTTON]: {
    page: 'inputs',
    anchor: 'pulse-button'
  },
  [BuiltInComponentType.GAMEPAD]: { page: 'inputs', anchor: 'gamepad' },
  [BuiltInComponentType.KEYBOARD]: { page: 'inputs', anchor: 'keyboard' },
  [BuiltInComponentType.LED]: { page: 'outputs', anchor: 'led' },
  [BuiltInComponentType.SEGMENT_DISPLAY]: {
    page: 'outputs',
    anchor: 'segment-display'
  },
  [BuiltInComponentType.LED_MATRIX]: { page: 'outputs', anchor: 'led-matrix' },
  [BuiltInComponentType.TERMINAL]: { page: 'outputs', anchor: 'terminal' },
  // Listed among the logic gates in the palette, but it is a wire feature.
  [BuiltInComponentType.TUNNEL]: {
    page: 'wires-and-connections',
    anchor: 'tunnels'
  },
  [BuiltInComponentType.INPUT]: { page: 'custom-components', anchor: 'ports' },
  [BuiltInComponentType.OUTPUT]: { page: 'custom-components', anchor: 'ports' },
  [BuiltInComponentType.TEXT]: {
    page: 'components-and-options',
    anchor: 'text-labels'
  }
};

/** Where every custom component is documented. */
const CUSTOM_COMPONENT_DOCS: DocsTarget = {
  page: 'custom-components',
  anchor: 'placing-and-updating'
};

/** The section documenting `type`, or null for an id no built-in has. */
export function componentDocs(type: ComponentType): DocsTarget | null {
  if (type >= CUSTOM_TYPE_ID_BASE) return CUSTOM_COMPONENT_DOCS;
  return BUILT_IN_DOCS[type as BuiltInComponentType] ?? null;
}
