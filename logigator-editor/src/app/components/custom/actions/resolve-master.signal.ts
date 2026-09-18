import { computed, Signal } from '@angular/core';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentDefinition } from '@logigator/core';

/**
 * Resolves a config type id to its master entry, re-running on a registry
 * revision change so a promotion's flipped source is reflected.
 */
export function resolveMasterSignal(
  registry: CustomComponentRegistry,
  typeId: () => number
): Signal<
  { masterTypeId: number; master: CustomComponentDefinition } | undefined
> {
  return computed(() => {
    registry.revision();
    return registry.resolveMaster(typeId());
  });
}
