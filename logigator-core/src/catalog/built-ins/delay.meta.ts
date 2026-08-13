import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, NO_LABELS } from '../component-meta';

export const delayMeta = {
  type: BuiltInComponentType.DELAY,
  category: ComponentCategory.BASIC,
  symbol: '1',
  name: 'components.def.DELAY.name',
  description: 'components.def.DELAY.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ({ inputs: 1, outputs: 1 }),
  labels: () => NO_LABELS,
  body: () => ({ width: 2, height: 1 })
} as const satisfies ComponentMeta;
