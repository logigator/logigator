import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { busLabels, ComponentMeta } from '../component-meta';

/** Data outputs: one per bit of a 7-bit ASCII code, `D0` the least significant. */
export const KEYBOARD_DATA_BITS = 7;

/** Output index of the strobe, which follows the data bits. */
export const KEYBOARD_STROBE_OUTPUT = KEYBOARD_DATA_BITS;

/** Output index of key down, which follows the strobe. */
export const KEYBOARD_KEY_DOWN_OUTPUT = KEYBOARD_STROBE_OUTPUT + 1;

/** Width of the glyph column the body draws beside its port labels. */
export const KEYBOARD_GLYPH_COLUMN_WIDTH = 3;

/**
 * Width of the label column beside the glyph column. `STB`, the longest label,
 * fits one cell at the canvas's full label size.
 */
const KEYBOARD_LABEL_COLUMN_WIDTH = 1;

const OUTPUT_LABELS = [...busLabels('D', KEYBOARD_DATA_BITS), 'STB', 'KD'];

/**
 * A keyboard: `D0`…`D6` carry the ASCII code of the last key pressed and
 * keep it until the next press replaces it, `STB` pulses for one tick on
 * every press, and `KD` is high while a key is down. Its arity is fixed, so
 * it has no options.
 */
export const keyboardMeta = {
  type: BuiltInComponentType.KEYBOARD,
  category: ComponentCategory.IO,
  symbol: 'KBD',
  name: 'components.def.KEYBOARD.name',
  description: 'components.def.KEYBOARD.description',
  options: {},
  ports: () => ({ inputs: 0, outputs: OUTPUT_LABELS.length }),
  labels: () => ({ inputs: [], outputs: [...OUTPUT_LABELS] }),
  body: () => ({
    width: KEYBOARD_GLYPH_COLUMN_WIDTH + KEYBOARD_LABEL_COLUMN_WIDTH,
    height: OUTPUT_LABELS.length
  })
} as const satisfies ComponentMeta;
