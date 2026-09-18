import { segmentDisplayMeta, SegmentBase } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { SelectButtonComponentOption } from '../../component-options/select-button/select-button.component-option';
import { SegmentDisplayComponent } from './segment-display.component';

export interface SegmentDisplayOptions {
  [key: string]: ComponentOption;
  numInputs: NumberComponentOption;
  base: SelectButtonComponentOption<SegmentBase>;
}

export const segmentDisplayComponentConfig: ComponentConfig<SegmentDisplayOptions> =
  configFromMeta(segmentDisplayMeta, {
    // A seven-segment digit, all segments lit: the readout is drawn in the
    // segment font, so the glyph is what identifies this type.
    symbolShape: {
      stroke: 'M6 3h6 M5 4v4 M13 4v4 M6 9h6 M5 10v4 M13 10v4 M6 15h6'
    },
    create: (options) => new SegmentDisplayComponent(options)
  });
