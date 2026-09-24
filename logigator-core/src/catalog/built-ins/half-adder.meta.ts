import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight } from '../component-meta';

const ports = { inputs: 2, outputs: 2 };

export const halfAdderMeta = {
  type: BuiltInComponentType.HALF_ADDER,
  category: ComponentCategory.ADVANCED,
  symbol: 'HA',
  name: 'components.def.HALF_ADDER.name',
  description: 'components.def.HALF_ADDER.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ports,
  labels: () => ({ inputs: ['A', 'B'], outputs: ['S', 'C'] }),
  body: () => ({ width: 3, height: defaultBodyHeight(ports) })
} as const satisfies ComponentMeta;
