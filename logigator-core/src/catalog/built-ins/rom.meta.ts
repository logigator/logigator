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
  category: ComponentCategory.ADVANCED,
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
    // Capped at 11 rather than the engine's 16 so a fully populated ROM's
    // bit-packed contents fit the v0 `s` field's 32768 chars: 2^11 × 64-bit
    // words = 16 KiB ≈ 21 845 base64 chars.
    addressSize: {
      kind: 'number',
      label: 'components.def.ROM.options.addressSize',
      min: 1,
      max: 11,
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
