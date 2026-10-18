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
  validOutput: string;
}

// The number bits, then the valid pin: high whenever any input is, so input 0
// alone reads differently from no input at all.
const ports = (o: EncoderValues) => ({
  inputs: 1 << o.numOutputs,
  outputs: o.numOutputs + (o.validOutput === 'on' ? 1 : 0)
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
    },
    // An encoder from a document older than the valid pin has none, which
    // only the migration sets: the pin would land on whatever wire already
    // ran past the output edge, and join its net.
    validOutput: {
      kind: 'select-button',
      label: 'components.def.ENCODER.options.validOutput',
      values: [{ value: 'on' }, { value: 'off' }],
      default: 'on',
      hidden: true
    }
  },
  legacyV0Slots: { n: ['numOutputs'] },
  ports,
  labels: (o) => {
    const { inputs } = ports(o);
    return {
      inputs: indexLabels(inputs),
      outputs: [
        ...bitWeightLabels(o.numOutputs),
        ...(o.validOutput === 'on' ? ['V'] : [])
      ]
    };
  },
  body: (o) => ({ width: 3, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<EncoderValues>;
