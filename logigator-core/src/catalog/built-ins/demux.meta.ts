import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import {
  busLabels,
  ComponentMeta,
  defaultBodyHeight,
  indexLabels
} from '../component-meta';

interface DemuxValues {
  selectLines: number;
}

// The single data input plus the select lines; one output per address.
const ports = (o: DemuxValues) => ({
  inputs: o.selectLines + 1,
  outputs: 1 << o.selectLines
});

export const demuxMeta = {
  type: BuiltInComponentType.DEMUX,
  category: ComponentCategory.ADVANCED,
  symbol: 'DEMUX',
  name: 'components.def.DEMUX.name',
  description: 'components.def.DEMUX.description',
  options: {
    selectLines: {
      kind: 'number',
      label: 'components.def.DEMUX.options.selectLines',
      min: 1,
      max: 6,
      default: 1
    }
  },
  legacyV0Slots: { n: ['selectLines'] },
  ports,
  labels: (o) => ({
    inputs: ['I', ...busLabels('S', o.selectLines)],
    outputs: indexLabels(ports(o).outputs)
  }),
  body: (o) => ({ width: 3, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<DemuxValues>;
