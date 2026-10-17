import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight } from '../component-meta';

const ports = { inputs: 3, outputs: 2 };

export const fullAdderMeta = {
  type: BuiltInComponentType.FULL_ADDER,
  category: ComponentCategory.ADVANCED,
  symbol: 'FA',
  name: 'components.def.FULL_ADDER.name',
  description: 'components.def.FULL_ADDER.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ports,
  labels: () => ({ inputs: ['A', 'B', 'Cin'], outputs: ['S', 'C'] }),
  body: () => ({ width: 3, height: defaultBodyHeight(ports) })
} as const satisfies ComponentMeta;
