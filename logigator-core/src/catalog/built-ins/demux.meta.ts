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
  pinOrder: string;
}

// The single data input plus the select lines; one output per address.
const ports = (o: DemuxValues) => ({
  inputs: o.selectLines + 1,
  outputs: 1 << o.selectLines
});

export const demuxMeta = {
  type: BuiltInComponentType.DEMUX,
  category: ComponentCategory.ADDERS_SELECTORS,
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
    },
    // The select lines come first, as on a MUX. A DEMUX from a document older
    // than that takes its data input first, which only the migration sets:
    // switching it would change what every wire on the inputs means.
    pinOrder: {
      kind: 'select-button',
      label: 'components.def.DEMUX.options.pinOrder',
      values: [{ value: 'selectFirst' }, { value: 'dataFirst' }],
      default: 'selectFirst',
      hidden: true
    }
  },
  legacyV0Slots: { n: ['selectLines'] },
  ports,
  labels: (o) => ({
    inputs:
      o.pinOrder === 'dataFirst'
        ? ['I', ...busLabels('S', o.selectLines)]
        : [...busLabels('S', o.selectLines), 'I'],
    outputs: indexLabels(ports(o).outputs)
  }),
  body: (o) => ({ width: 3, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<DemuxValues>;
