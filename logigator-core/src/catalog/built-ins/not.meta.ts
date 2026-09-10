import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, NO_LABELS } from '../component-meta';

export const notMeta = {
  type: BuiltInComponentType.NOT,
  category: ComponentCategory.BASIC,
  symbol: '!',
  name: 'components.def.NOT.name',
  description: 'components.def.NOT.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ({ inputs: 1, outputs: 1 }),
  labels: () => NO_LABELS,
  body: () => ({ width: 2, height: 1 })
} as const satisfies ComponentMeta;
