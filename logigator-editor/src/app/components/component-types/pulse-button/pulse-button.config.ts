import { pulseButtonMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { PulseButtonComponent } from './pulse-button.component';

export type PulseButtonOptions = Record<string, ComponentOption>;

export const pulseButtonComponentConfig: ComponentConfig<PulseButtonOptions> =
  configFromMeta(pulseButtonMeta, {
    // The square body and its inset inner square, unpressed.
    symbolShape: { stroke: 'M1 1h16v16H1z M4 4h10v10H4z' },
    create: (options) => new PulseButtonComponent(options)
  });
