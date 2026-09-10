import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight, NO_LABELS } from '../component-meta';

interface OrValues {
  numInputs: number;
}

const ports = (o: OrValues) => ({ inputs: o.numInputs, outputs: 1 });

export const orMeta = {
  type: BuiltInComponentType.OR,
  category: ComponentCategory.BASIC,
  symbol: '≥1',
  name: 'components.def.OR.name',
  description: 'components.def.OR.description',
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
} as const satisfies ComponentMeta<OrValues>;
