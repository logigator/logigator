import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { SelectButtonComponentOption } from '../../component-options/select-button/select-button.component-option';
import { LedMatrixComponent } from './led-matrix.component';

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

export interface LedMatrixOptions {
  [key: string]: ComponentOption;
  size: SelectButtonComponentOption<number>;
}

export const ledMatrixComponentConfig: ComponentConfig<LedMatrixOptions> = {
  type: BuiltInComponentType.LED_MATRIX,
  category: ComponentCategory.IO,
  symbol: 'LED_M',
  name: 'components.def.LED_MATRIX.name',
  description: 'components.def.LED_MATRIX.description',
  options: {
    size: new SelectButtonComponentOption<number>(
      'components.def.LED_MATRIX.options.size',
      [
        { value: 4, label: '4' },
        { value: 8, label: '8' },
        { value: 16, label: '16' }
      ],
      4
    )
  },
  legacyV0Slots: { n: ['size'] },
  create: (options) => new LedMatrixComponent(options)
};
