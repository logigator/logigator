import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight, NO_LABELS } from '../component-meta';

interface AndValues {
  numInputs: number;
}

const ports = (o: AndValues) => ({ inputs: o.numInputs, outputs: 1 });

export const andMeta = {
  type: BuiltInComponentType.AND,
  category: ComponentCategory.BASIC,
  symbol: '&',
  name: 'components.def.AND.name',
  description: 'components.def.AND.description',
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
} as const satisfies ComponentMeta<AndValues>;
