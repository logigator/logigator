import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, NO_LABELS } from '../component-meta';

export const pulseButtonMeta = {
  type: BuiltInComponentType.PULSE_BUTTON,
  category: ComponentCategory.IO,
  symbol: 'PLS',
  name: 'components.def.PULSE_BUTTON.name',
  description: 'components.def.PULSE_BUTTON.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ({ inputs: 0, outputs: 1 }),
  labels: () => NO_LABELS,
  body: () => ({ width: 1, height: 1 })
} as const satisfies ComponentMeta;
