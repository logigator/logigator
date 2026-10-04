import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight } from '../component-meta';

const ports = { inputs: 2, outputs: 2 };

export const dFfMeta = {
  type: BuiltInComponentType.D_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'D',
  name: 'components.def.D_FF.name',
  description: 'components.def.D_FF.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ports,
  labels: () => ({ inputs: ['D', 'CLK'], outputs: ['Q', '!Q'] }),
  body: () => ({ width: 3, height: defaultBodyHeight(ports) })
} as const satisfies ComponentMeta;
