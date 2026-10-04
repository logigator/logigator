import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight, NO_LABELS } from '../component-meta';

interface XorValues {
  numInputs: number;
}

const ports = (o: XorValues) => ({ inputs: o.numInputs, outputs: 1 });

export const xorMeta = {
  type: BuiltInComponentType.XOR,
  category: ComponentCategory.BASIC,
  symbol: '=1',
  name: 'components.def.XOR.name',
  description: 'components.def.XOR.description',
  options: {
    numInputs: {
      kind: 'number',
      label: 'components.options.inputs',
      min: 2,
      max: 64,
      default: 2
    }
  },
  legacyV0Slots: { i: 'numInputs' },
  ports,
  labels: () => NO_LABELS,
  body: (o) => ({ width: 2, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<XorValues>;
