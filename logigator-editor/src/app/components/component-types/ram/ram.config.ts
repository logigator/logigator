import { ramMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { RamComponent } from './ram.component';
import { RamInspection } from './ram-inspection';

export interface RamOptions {
  [key: string]: ComponentOption;
  wordSize: NumberComponentOption;
  addressSize: NumberComponentOption;
}

export const ramComponentConfig: ComponentConfig<RamOptions> = configFromMeta(
  ramMeta,
  {
    // The inspection service always hands over the route for where the RAM
    // was opened; without one there would be no memory to read.
    inspection: (component, context) => {
      if (!context) {
        throw new Error('A RAM inspection needs a state route');
      }
      return new RamInspection(component as RamComponent, context.state);
    },
    create: (options) => new RamComponent(options)
  }
);
