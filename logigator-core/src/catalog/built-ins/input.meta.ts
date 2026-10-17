import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, NO_LABELS } from '../component-meta';

/**
 * Option set shared by the two plug types: a user-facing port name and the
 * system-managed port order. The name allows no commas because labels are
 * stored comma-joined; the index is hidden because ports are reordered through
 * the Ports panel, never by typing.
 */
export const PLUG_OPTIONS = {
  label: {
    kind: 'text',
    label: 'components.options.label',
    maxLength: 5,
    forbiddenChars: ',',
    default: ''
  },
  index: {
    kind: 'number',
    label: 'components.options.index',
    min: 0,
    max: 999,
    default: 0,
    hidden: true
  }
} as const;

/** The v0 slots both plugs share. */
export const PLUG_LEGACY_V0_SLOTS = { s: 'label', n: ['index'] } as const;

/**
 * A plug's port counts are fixed: an INPUT exposes exactly one output, the
 * signal it feeds into the circuit. The `i`/`o` slots are ignored on load.
 */
export const inputMeta = {
  type: BuiltInComponentType.INPUT,
  category: ComponentCategory.PORT,
  symbol: 'IN',
  name: 'components.def.INPUT.name',
  description: 'components.def.INPUT.description',
  options: PLUG_OPTIONS,
  legacyV0Slots: PLUG_LEGACY_V0_SLOTS,
  ports: () => ({ inputs: 0, outputs: 1 }),
  labels: () => NO_LABELS,
  body: () => ({ width: 1, height: 1 })
} as const satisfies ComponentMeta;
