import { ledMatrixMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { SelectButtonComponentOption } from '../../component-options/select-button/select-button.component-option';
import { LedMatrixComponent } from './led-matrix.component';

export interface LedMatrixOptions {
  [key: string]: ComponentOption;
  size: SelectButtonComponentOption<number>;
}

export const ledMatrixComponentConfig: ComponentConfig<LedMatrixOptions> =
  configFromMeta(ledMatrixMeta, {
    // Grid lines rather than the discrete cells the canvas draws: at tile
    // size the separate squares close up into a block, while the ruling still
    // reads as a matrix.
    symbolShape: {
      stroke: 'M1 1h16v16H1z M5 1v16 M9 1v16 M13 1v16 M1 5h16 M1 9h16 M1 13h16'
    },
    create: (options) => new LedMatrixComponent(options)
  });
