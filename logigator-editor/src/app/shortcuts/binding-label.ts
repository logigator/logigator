import { computed, Signal } from '@angular/core';
import { formatShortcutLabel } from '@logigator/ui';
import { ShortcutActionEnum } from './shortcut-action.enum';
import { ShortcutService } from './shortcut.service';

/**
 * The label of one binding as a string, tracking rebinds live — for the hints
 * that name a key the user can change. Call it from a field initializer, where
 * `computed` has an injection context.
 */
export function bindingLabel(
  shortcuts: ShortcutService,
  action: ShortcutActionEnum
): Signal<string> {
  return computed(() => {
    const binding = shortcuts.binding(action)();
    return binding ? formatShortcutLabel(binding) : '–';
  });
}
