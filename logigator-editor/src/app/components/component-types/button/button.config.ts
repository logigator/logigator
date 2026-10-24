import { buttonMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { ButtonComponent } from './button.component';

export type ButtonOptions = Record<string, ComponentOption>;

export const buttonComponentConfig: ComponentConfig<ButtonOptions> =
  configFromMeta(buttonMeta, {
    // The square body and its inset circle, released.
    symbolShape: {
      stroke: 'M1 1h16v16H1z M9 4a5 5 0 1 0 0 10a5 5 0 1 0 0-10z'
    },
    create: (options) => new ButtonComponent(options)
  });
