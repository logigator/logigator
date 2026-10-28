import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight } from '../component-meta';

interface RomValues {
  wordSize: number;
  addressSize: number;
  data: string;
}

const ports = (o: RomValues) => ({
  inputs: o.addressSize,
  outputs: o.wordSize
});

/** `['A1', 'A2', … ]` / `['O1', 'O2', … ]` — the ROM's one-based pin names. */
const pins = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

export const romMeta = {
  type: BuiltInComponentType.ROM,
  category: ComponentCategory.MEMORY,
  symbol: 'ROM',
  name: 'components.def.ROM.name',
  description: 'components.def.ROM.description',
  options: {
    wordSize: {
      kind: 'number',
      label: 'components.def.ROM.options.wordSize',
      min: 1,
      max: 64,
      default: 4
    },
    // Capped at 12 rather than the engine's 16: the contents are stored in the
    // document, and a full ROM at 2^12 × 64-bit words is 32 KiB ≈ 43 690
    // base64 chars, where 16 bits would be 512 KiB per ROM.
    addressSize: {
      kind: 'number',
      label: 'components.def.ROM.options.addressSize',
      min: 1,
      max: 12,
      default: 4
    },
    data: {
      kind: 'memory',
      label: 'components.def.ROM.options.data',
      default: ''
    }
  },
  legacyV0Slots: { s: 'data', n: ['wordSize', 'addressSize'] },
  ports,
  labels: (o) => ({
    inputs: pins('A', o.addressSize),
    outputs: pins('O', o.wordSize)
  }),
  body: (o) => ({ width: 3, height: defaultBodyHeight(ports(o)) })
} as const satisfies ComponentMeta<RomValues>;
