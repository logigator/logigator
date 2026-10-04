import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, NO_LABELS } from '../component-meta';
import { PLUG_LEGACY_V0_SLOTS, PLUG_OPTIONS } from './input.meta';

/**
 * The INPUT plug's mirror: an OUTPUT exposes exactly one input — the signal it
 * draws out of the circuit. See {@link inputMeta} for the shared plug rules.
 */
export const outputMeta = {
  type: BuiltInComponentType.OUTPUT,
  category: ComponentCategory.PORT,
  symbol: 'OUT',
  name: 'components.def.OUTPUT.name',
  description: 'components.def.OUTPUT.description',
  options: PLUG_OPTIONS,
  legacyV0Slots: PLUG_LEGACY_V0_SLOTS,
  ports: () => ({ inputs: 1, outputs: 0 }),
  labels: () => NO_LABELS,
  body: () => ({ width: 1, height: 1 })
} as const satisfies ComponentMeta;
