import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, NO_LABELS } from '../component-meta';

export const ledMeta = {
  type: BuiltInComponentType.LED,
  category: ComponentCategory.IO,
  symbol: 'LED',
  name: 'components.def.LED.name',
  description: 'components.def.LED.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ({ inputs: 1, outputs: 0 }),
  labels: () => NO_LABELS,
  body: () => ({ width: 1, height: 1 })
} as const satisfies ComponentMeta;
