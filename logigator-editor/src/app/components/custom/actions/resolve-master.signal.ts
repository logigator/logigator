import { computed, Signal } from '@angular/core';
import { CustomComponentRegistry } from '../custom-component-registry.service';
import { CustomComponentDefinition } from '@logigator/core';

/**
 * A computed that resolves an instance's config type id to its master entry,
 * re-running when the registry revision changes so a promotion (which flips a
 * master's source) is reflected. Shared by the per-instance actions that gate
 * their button on whether the master is local or in the cloud.
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
