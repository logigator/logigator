import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta } from '../component-meta';

/**
 * Upper bound of the engine's `u32` half-cycle field. `Number.MAX_SAFE_INTEGER`
 * would deserialize as a value out of `u32` range and be rejected outright.
 */
const MAX_HALF_CYCLE_TICKS = 4294967295;

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
      max: MAX_HALF_CYCLE_TICKS,
      default: 1
    }
  },
  legacyV0Slots: { n: ['speed'] },
  ports: () => ({ inputs: 1, outputs: 1 }),
  labels: () => ({ inputs: ['STP'], outputs: ['CLK'] }),
  body: () => ({ width: 3, height: 2 })
} as const satisfies ComponentMeta;
