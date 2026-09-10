import { buttonMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { ButtonComponent } from './button.component';

export type ButtonOptions = Record<string, ComponentOption>;

export const buttonComponentConfig: ComponentConfig<ButtonOptions> =
  configFromMeta(buttonMeta, {
    // The square body and its inset inner square, unpressed.
    symbolShape: { stroke: 'M1 1h16v16H1z M4 4h10v10H4z' },
    create: (options) => new ButtonComponent(options)
  });
