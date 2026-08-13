import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight } from '../component-meta';

const ports = { inputs: 3, outputs: 2 };

export const srFfMeta = {
  type: BuiltInComponentType.SR_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'SR',
  name: 'components.def.SR_FF.name',
  description: 'components.def.SR_FF.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ports,
  labels: () => ({ inputs: ['S', 'CLK', 'R'], outputs: ['Q', '!Q'] }),
  body: () => ({ width: 3, height: defaultBodyHeight(ports) })
} as const satisfies ComponentMeta;
