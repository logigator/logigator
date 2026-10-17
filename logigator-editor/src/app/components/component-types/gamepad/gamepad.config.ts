import { gamepadControls, gamepadMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { SelectButtonComponentOption } from '../../component-options/select-button/select-button.component-option';
import { NameMapComponentOption } from '../../component-options/name-map/name-map.component-option';
import { GamepadComponent } from './gamepad.component';
import { GamepadInspection } from './gamepad-inspection';
import { GamepadNamesEditorComponent } from './gamepad-names-editor.component';

export interface GamepadOptions {
  [key: string]: ComponentOption;
  face: SelectButtonComponentOption<number>;
  shoulders: SelectButtonComponentOption<number>;
  menu: SelectButtonComponentOption<number>;
  names: NameMapComponentOption;
}

/**
 * Links the names option to the controls the face, shoulder and menu options
 * of the same set switch on, and to the pad's names editor.
 */
export function bindGamepadOptions(options: GamepadOptions): void {
  options.names
    .attachKeys(() =>
      gamepadControls({
        face: options.face.value,
        shoulders: options.shoulders.value,
        menu: options.menu.value
      })
    )
    .attachEditor(GamepadNamesEditorComponent);
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
    // The inspection service always hands over the route for where the pad
    // was opened; a gamepad without one could play nothing.
    inspection: (component, context) => {
      if (!context) {
        throw new Error('A gamepad inspection needs an input route');
      }
      return new GamepadInspection(
        component as GamepadComponent,
        context.input
      );
    },
    bindOptions: bindGamepadOptions,
    create: (options) => new GamepadComponent(options)
  });
