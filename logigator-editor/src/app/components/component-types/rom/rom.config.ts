import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
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

export const romComponentConfig: ComponentConfig<RomOptions> = {
  type: BuiltInComponentType.ROM,
  category: ComponentCategory.ADVANCED,
  symbol: 'ROM',
  name: 'components.def.ROM.name',
  description: 'components.def.ROM.description',
  options: {
    wordSize: new NumberComponentOption(
      'components.def.ROM.options.wordSize',
      1,
      64,
      4
    ),
    // addressSize is capped at 11 (not the engine's 16) so a fully populated
    // ROM's bit-packed contents stay within the legacy server `s` field's
    // 32768-char limit: 2^11 words × 64-bit words = 16 KiB ≈ 21 845 base64
    // chars. Trailing-zero trimming on save keeps typical ROMs far smaller.
    addressSize: new NumberComponentOption(
      'components.def.ROM.options.addressSize',
      1,
      11,
      4
    ),
    data: new MemoryDataComponentOption('components.def.ROM.options.data')
  },
  legacyV0Slots: { s: 'data', n: ['wordSize', 'addressSize'] },
  inspection: (component) => new RomInspection(component as RomComponent),
  create: (options) => new RomComponent(options)
};
