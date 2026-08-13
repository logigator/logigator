import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { TextInputComponentOption } from '../../component-options/text-input/text-input.component-option';
import { TunnelComponent } from './tunnel.component';

export interface TunnelOptions {
  [key: string]: ComponentOption;
  // Net name: all tunnels carrying the same label are electrically joined at
  // compile time. The legacy editor used numeric ids; the v0 codec maps digit
  // labels to their number and other labels to generated group ids (see
  // `server-circuit.codec.ts`), so `legacyV0Slots` deliberately omits the
  // `n`/`s` slots.
  label: TextInputComponentOption;
}

export const tunnelComponentConfig: ComponentConfig<TunnelOptions> = {
  type: BuiltInComponentType.TUNNEL,
  category: ComponentCategory.BASIC,
  symbol: '~',
  name: 'components.def.TUNNEL.name',
  description: 'components.def.TUNNEL.description',
  options: {
    label: new TextInputComponentOption('components.options.label', '0', {
      maxLength: 10
    })
  },
  legacyV0Slots: {},
  create: (options) => new TunnelComponent(options)
};
