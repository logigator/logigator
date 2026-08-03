import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { SelectButtonComponentOption } from '../../component-options/select-button/select-button.component-option';
import { SegmentDisplayComponent } from './segment-display.component';

/** Readout number base — the values are the legacy `n[0]` encoding. */
export const enum SegmentBase {
  DEC = 0,
  HEX = 1,
  OCT = 2
}

export interface SegmentDisplayOptions {
  [key: string]: ComponentOption;
  numInputs: NumberComponentOption;
  base: SelectButtonComponentOption<SegmentBase>;
}

export const segmentDisplayComponentConfig: ComponentConfig<SegmentDisplayOptions> =
  {
    type: BuiltInComponentType.SEGMENT_DISPLAY,
    category: ComponentCategory.IO,
    symbol: 'SEG',
    // A seven-segment digit, all segments lit: the readout is drawn in the
    // segment font, so no fixed body shape identifies this type — the glyph does.
    symbolShape: {
      stroke: 'M6 3h6 M5 4v4 M13 4v4 M6 9h6 M5 10v4 M13 10v4 M6 15h6'
    },
    name: 'components.def.SEGMENT_DISPLAY.name',
    description: 'components.def.SEGMENT_DISPLAY.description',
    options: {
      numInputs: new NumberComponentOption(
        'components.options.inputs',
        1,
        16,
        2
      ),
      base: new SelectButtonComponentOption<SegmentBase>(
        'components.def.SEGMENT_DISPLAY.options.base',
        [
          { value: SegmentBase.DEC, label: 'DEC' },
          { value: SegmentBase.HEX, label: 'HEX' },
          { value: SegmentBase.OCT, label: 'OCT' }
        ],
        SegmentBase.DEC
      )
    },
    legacyV0Slots: { i: 'numInputs', n: ['base'] },
    create: (options) => new SegmentDisplayComponent(options)
  };
