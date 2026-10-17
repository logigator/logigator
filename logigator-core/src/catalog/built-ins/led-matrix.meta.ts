import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { busLabels, ComponentMeta } from '../component-meta';

/** Side lengths the engine's LED-matrix unit supports. */
export type LedMatrixSize = 4 | 8 | 16;

/**
 * Per-size shape: the fixed input layout (`A0..`, `D0..`, `CLK`) and the
 * square body's side in grid cells. The LED cells themselves are the engine
 * unit's outputs — they exist only inside the simulator, never as editor
 * ports.
 */
export function ledMatrixShape(size: number): {
  size: LedMatrixSize;
  addressBits: number;
  dataBits: number;
  numInputs: number;
  bodyCells: number;
} {
  const normalized: LedMatrixSize = size === 8 ? 8 : size === 16 ? 16 : 4;
  const addressBits = normalized === 4 ? 2 : normalized === 8 ? 3 : 5;
  const dataBits = normalized < 8 ? 4 : 8;
  const bodyCells = normalized === 4 ? 7 : normalized === 8 ? 12 : 16;
  return {
    size: normalized,
    addressBits,
    dataBits,
    numInputs: addressBits + dataBits + 1,
    bodyCells
  };
}

interface LedMatrixValues {
  size: number;
}

export const ledMatrixMeta = {
  type: BuiltInComponentType.LED_MATRIX,
  category: ComponentCategory.IO,
  symbol: 'LED_M',
  name: 'components.def.LED_MATRIX.name',
  description: 'components.def.LED_MATRIX.description',
  options: {
    size: {
      kind: 'select-button',
      label: 'components.def.LED_MATRIX.options.size',
      values: [
        { value: 4, label: '4' },
        { value: 8, label: '8' },
        { value: 16, label: '16' }
      ],
      default: 4
    }
  },
  legacyV0Slots: { n: ['size'] },
  ports: (o) => ({ inputs: ledMatrixShape(o.size).numInputs, outputs: 0 }),
  labels: (o) => {
    const { addressBits, dataBits } = ledMatrixShape(o.size);
    return {
      inputs: [
        ...busLabels('A', addressBits),
        ...busLabels('D', dataBits),
        'CLK'
      ],
      outputs: []
    };
  },
  body: (o) => {
    const { bodyCells } = ledMatrixShape(o.size);
    return { width: bodyCells, height: bodyCells };
  }
} as const satisfies ComponentMeta<LedMatrixValues>;
