import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight } from '../component-meta';

const ports = { inputs: 3, outputs: 2 };

export const jkFfMeta = {
  type: BuiltInComponentType.JK_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'JK',
  name: 'components.def.JK_FF.name',
  description: 'components.def.JK_FF.description',
  options: {},
  legacyV0Slots: {},
  ports: () => ports,
  labels: () => ({ inputs: ['J', 'CLK', 'K'], outputs: ['Q', '!Q'] }),
  body: () => ({ width: 3, height: defaultBodyHeight(ports) })
} as const satisfies ComponentMeta;
