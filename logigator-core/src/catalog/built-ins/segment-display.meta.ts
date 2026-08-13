import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, indexLabels } from '../component-meta';

/** Readout number base — the values are the legacy `n[0]` encoding. */
export enum SegmentBase {
  DEC = 0,
  HEX = 1,
  OCT = 2
}

/** How many digits the readout of `inputs` bits needs in `base`. */
export function segmentReadoutDigits(
  base: SegmentBase,
  inputs: number
): number {
  switch (base) {
    case SegmentBase.HEX:
      return Math.ceil(inputs / 4);
    case SegmentBase.OCT:
      return Math.ceil(inputs / 3);
    default:
      return Math.ceil(Math.log10(2 ** inputs + 1));
  }
}

interface SegmentDisplayValues {
  numInputs: number;
  base: SegmentBase;
}

const ports = (o: SegmentDisplayValues) => ({
  inputs: o.numInputs,
  outputs: 0
});

/**
 * A display-only readout: not a simulator unit, it renders the binary value on
 * its input nets as a zero-padded number in the configured base.
 */
export const segmentDisplayMeta = {
  type: BuiltInComponentType.SEGMENT_DISPLAY,
  category: ComponentCategory.IO,
  symbol: 'SEG',
  name: 'components.def.SEGMENT_DISPLAY.name',
  description: 'components.def.SEGMENT_DISPLAY.description',
  options: {
    numInputs: {
      kind: 'number',
      label: 'components.options.inputs',
      min: 1,
      max: 16,
      default: 2
    },
    base: {
      kind: 'select-button',
      label: 'components.def.SEGMENT_DISPLAY.options.base',
      values: [
        { value: SegmentBase.DEC, label: 'DEC' },
        { value: SegmentBase.HEX, label: 'HEX' },
        { value: SegmentBase.OCT, label: 'OCT' }
      ],
      default: SegmentBase.DEC
    }
  },
  legacyV0Slots: { i: 'numInputs', n: ['base'] },
  ports,
  labels: (o) => ({ inputs: indexLabels(o.numInputs), outputs: [] }),
  // The readout decides the width, so a rotated display would grow along the
  // wrong axis — upright quarter-turns take a fixed four cells instead. Three
  // rows minimum so the digits have room even with a single input.
  body: (o, direction) => {
    const width =
      direction % 2 === 1 ? 4 : 2 + segmentReadoutDigits(o.base, o.numInputs);
    const { inputs, outputs } = ports(o);
    return { width, height: Math.max(3, inputs, outputs) };
  }
} as const satisfies ComponentMeta<SegmentDisplayValues>;
