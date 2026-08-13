import { romMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { MemoryDataComponentOption } from '../../component-options/memory-data/memory-data.component-option';
import { RomComponent } from './rom.component';
import { RomInspection } from './rom-inspection';

export interface RomOptions {
  [key: string]: ComponentOption;
  wordSize: NumberComponentOption;
  addressSize: NumberComponentOption;
  data: MemoryDataComponentOption;
}

export const romComponentConfig: ComponentConfig<RomOptions> = configFromMeta(
  romMeta,
  {
    inspection: (component) => new RomInspection(component as RomComponent),
    create: (options) => new RomComponent(options)
  }
);
