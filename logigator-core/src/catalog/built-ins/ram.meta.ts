import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { busLabels, ComponentMeta, defaultBodyHeight } from '../component-meta';

interface RamValues {
  wordSize: number;
  addressSize: number;
}

// Address and data lines plus the WE and CLK controls (engine pin order).
const ports = (o: RamValues) => ({
  inputs: o.addressSize + o.wordSize + 2,
  outputs: o.wordSize
});

export const ramMeta = {
  type: BuiltInComponentType.RAM,
  category: ComponentCategory.ADVANCED,
  symbol: 'RAM',
  name: 'components.def.RAM.name',
  description: 'components.def.RAM.description',
  options: {
    wordSize: {
      kind: 'number',
      label: 'components.def.RAM.options.wordSize',
      min: 1,
      max: 64,
      default: 4
    },
    addressSize: {
      kind: 'number',
      label: 'components.def.RAM.options.addressSize',
      min: 1,
      max: 16,
      default: 4
    }
  },
  legacyV0Slots: { n: ['wordSize', 'addressSize'] },
  ports,
  labels: (o) => ({
    inputs: [
      ...busLabels('A', o.addressSize),
      ...busLabels('D', o.wordSize),
      'WE',
      'CLK'
    ],
    outputs: busLabels('D', o.wordSize)
  }),
  body: (o) => ({ width: 3, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<RamValues>;
