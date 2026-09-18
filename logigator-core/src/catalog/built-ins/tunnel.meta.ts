import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, defaultBodyHeight } from '../component-meta';

interface TunnelValues {
  label: string;
}

const ports = { inputs: 1, outputs: 0 };

/** Wire teleport: every tunnel carrying the same label shares one net. */
export const tunnelMeta = {
  type: BuiltInComponentType.TUNNEL,
  category: ComponentCategory.BASIC,
  symbol: '~',
  name: 'components.def.TUNNEL.name',
  description: 'components.def.TUNNEL.description',
  options: {
    label: {
      kind: 'text',
      label: 'components.options.label',
      maxLength: 10,
      default: '0'
    }
  },
  legacyV0Slots: {},
  ports: () => ports,
  labels: (o) => ({ inputs: [o.label], outputs: [] }),
  body: () => ({ width: 2, height: defaultBodyHeight(ports) })
} as const satisfies ComponentMeta<TunnelValues>;
