import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta } from '../component-meta';

export const clockMeta = {
  type: BuiltInComponentType.CLOCK,
  category: ComponentCategory.BASIC,
  symbol: 'clk',
  name: 'components.def.CLOCK.name',
  description: 'components.def.CLOCK.description',
  options: {
    speed: {
      kind: 'number',
      label: 'components.def.CLOCK.options.speed',
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
      default: 1
    }
  },
  legacyV0Slots: { n: ['speed'] },
  ports: () => ({ inputs: 1, outputs: 1 }),
  labels: () => ({ inputs: ['STP'], outputs: ['CLK'] }),
  body: () => ({ width: 3, height: 2 })
} as const satisfies ComponentMeta;
