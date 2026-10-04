import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import {
  busLabels,
  ComponentMeta,
  defaultBodyHeight,
  indexLabels
} from '../component-meta';

interface MuxValues {
  selectLines: number;
}

// The select lines plus one data line per addressable input.
const ports = (o: MuxValues) => ({
  inputs: o.selectLines + (1 << o.selectLines),
  outputs: 1
});

export const muxMeta = {
  type: BuiltInComponentType.MUX,
  category: ComponentCategory.ADVANCED,
  symbol: 'MUX',
  name: 'components.def.MUX.name',
  description: 'components.def.MUX.description',
  options: {
    selectLines: {
      kind: 'number',
      label: 'components.def.MUX.options.selectLines',
      min: 1,
      max: 6,
      default: 1
    }
  },
  legacyV0Slots: { n: ['selectLines'] },
  ports,
  labels: (o) => ({
    inputs: [
      ...busLabels('S', o.selectLines),
      ...indexLabels(ports(o).inputs - o.selectLines)
    ],
    outputs: []
  }),
  body: (o) => ({ width: 3, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<MuxValues>;
