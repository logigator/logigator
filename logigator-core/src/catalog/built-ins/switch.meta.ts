import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, NO_LABELS } from '../component-meta';

export const switchMeta = {
  type: BuiltInComponentType.SWITCH,
  category: ComponentCategory.IO,
  symbol: 'SW',
  name: 'components.def.SWITCH.name',
  description: 'components.def.SWITCH.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ({ inputs: 0, outputs: 1 }),
  labels: () => NO_LABELS,
  body: () => ({ width: 1, height: 1 })
} as const satisfies ComponentMeta;
