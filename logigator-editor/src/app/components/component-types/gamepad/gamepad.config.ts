import { gamepadMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { SelectButtonComponentOption } from '../../component-options/select-button/select-button.component-option';
import { TextInputComponentOption } from '../../component-options/text-input/text-input.component-option';
import { NameMapComponentOption } from '../../component-options/name-map/name-map.component-option';
import { GamepadComponent } from './gamepad.component';

export interface GamepadOptions {
  [key: string]: ComponentOption;
  face: SelectButtonComponentOption<number>;
  shoulders: SelectButtonComponentOption<number>;
  menu: SelectButtonComponentOption<number>;
  label: TextInputComponentOption;
  names: NameMapComponentOption;
}

export const gamepadComponentConfig: ComponentConfig<GamepadOptions> =
  configFromMeta(gamepadMeta, {
    // A controller silhouette: a stadium body, the D-pad cross on the left and
    // the default A/B pair on the right.
    symbolShape: {
      stroke:
        'M5 5h8a4 4 0 0 1 0 8H5a4 4 0 0 1 0-8z ' +
        'M4.3 7h1.4v1.3H7v1.4H5.7V11H4.3V9.7H3V8.3h1.3z ' +
        'M10.5 10.2a1 1 0 1 0 2 0a1 1 0 1 0-2 0z ' +
        'M12.8 7.8a1 1 0 1 0 2 0a1 1 0 1 0-2 0z'
    },
    create: (options) => new GamepadComponent(options)
  });
