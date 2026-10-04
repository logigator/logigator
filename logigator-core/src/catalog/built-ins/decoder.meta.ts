import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import {
  bitWeightLabels,
  ComponentMeta,
  defaultBodyHeight,
  indexLabels
} from '../component-meta';

interface DecoderValues {
  numInputs: number;
}

const ports = (o: DecoderValues) => ({
  inputs: o.numInputs,
  outputs: 1 << o.numInputs
});

export const decoderMeta = {
  type: BuiltInComponentType.DECODER,
  category: ComponentCategory.ADVANCED,
  symbol: 'DEC',
  name: 'components.def.DECODER.name',
  description: 'components.def.DECODER.description',
  options: {
    numInputs: {
      kind: 'number',
      label: 'components.options.inputs',
      min: 1,
      max: 6,
      default: 2
    }
  },
  legacyV0Slots: { n: ['numInputs'] },
  ports,
  labels: (o) => {
    const { inputs, outputs } = ports(o);
    return {
      inputs: bitWeightLabels(inputs),
      outputs: indexLabels(outputs)
    };
  },
  body: (o) => ({ width: 3, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<DecoderValues>;
