import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta, NO_LABELS, NO_PORTS } from '../component-meta';

/**
 * A free-standing board annotation. Its rendered glyphs overflow the body far
 * to the side, but the body itself stays the 1×1 anchor cell that selection and
 * collision use — the overflow is a rendering concern, handled in the editor.
 */
export const textMeta = {
  type: BuiltInComponentType.TEXT,
  category: ComponentCategory.HIDDEN,
  symbol: 'T',
  name: 'components.def.TEXT.name',
  description: 'components.def.TEXT.description',
  options: {
    fontSize: {
      kind: 'number',
      label: 'components.def.TEXT.options.fontSize',
      min: 2,
      max: 128,
      default: 12
    },
    text: {
      kind: 'textarea',
      label: 'components.def.TEXT.options.text',
      placeholder: 'components.def.TEXT.options.placeholder',
      maxLength: 500,
      default: '[insert text]'
    }
  },
  legacyV0Slots: { n: ['fontSize'], s: 'text' },
  ports: () => NO_PORTS,
  labels: () => NO_LABELS,
  body: () => ({ width: 1, height: 1 })
} as const satisfies ComponentMeta;
