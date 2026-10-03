import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, indexLabels } from '../component-meta';

interface RngValues {
  numOutputs: number;
}

const ports = (o: RngValues) => ({ inputs: 1, outputs: o.numOutputs });

export const rngMeta = {
  type: BuiltInComponentType.RNG,
  category: ComponentCategory.ADVANCED,
  symbol: 'RNG',
  name: 'components.def.RNG.name',
  description: 'components.def.RNG.description',
  options: {
    numOutputs: {
      kind: 'number',
      label: 'components.options.outputs',
      min: 1,
      max: 64,
      default: 1
    }
  },
  legacyV0Slots: { n: ['numOutputs'] },
  ports,
  labels: (o) => ({ inputs: ['CLK'], outputs: indexLabels(o.numOutputs) }),
  // Two rows minimum: the symbol needs the room even with a single output.
  body: (o) => {
    const { inputs, outputs } = ports(o);
    return { width: 3, height: Math.max(2, inputs, outputs) };
  }
} as const satisfies ComponentMeta<RngValues>;
