import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import {
  bitWeightLabels,
  ComponentMeta,
  defaultBodyHeight,
  indexLabels
} from '../component-meta';

interface EncoderValues {
  numOutputs: number;
}

const ports = (o: EncoderValues) => ({
  inputs: 1 << o.numOutputs,
  outputs: o.numOutputs
});

export const encoderMeta = {
  type: BuiltInComponentType.ENCODER,
  category: ComponentCategory.ADVANCED,
  symbol: 'ENC',
  name: 'components.def.ENCODER.name',
  description: 'components.def.ENCODER.description',
  options: {
    numOutputs: {
      kind: 'number',
      label: 'components.options.outputs',
      min: 1,
      max: 6,
      default: 1
    }
  },
  legacyV0Slots: { n: ['numOutputs'] },
  ports,
  labels: (o) => {
    const { inputs, outputs } = ports(o);
    return {
      inputs: indexLabels(inputs),
      outputs: bitWeightLabels(outputs)
    };
  },
  body: (o) => ({ width: 3, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<EncoderValues>;
