import type { Project } from '../../project/project';
import { ComponentConfig } from '../component-config.model';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { getStaticDI } from '../../utils/get-di';
import { CustomComponentRegistry } from './custom-component-registry.service';

/**
 * Whether placing `config` into `project` closes a dependency cycle, which is
 * possible only for a custom master placed into the editor for a master it
 * transitively feeds. Built-ins, frozen snapshots and the main project never
 * cycle.
 *
 * The palette already hides masters that would cycle, but a stale
 * `componentToPlace` or an automation call naming any type id reaches here too.
 */
export function wouldCyclePlacement(
  project: Project,
  config: ComponentConfig
): boolean {
  const registry = getStaticDI(CustomComponentRegistry);
  const placeDef = registry.getDefinition(config.type);
  if (placeDef?.kind !== 'master') return false;

  const meta = getStaticDI(ProjectMetadataStore).getMetadata(project);
  if (meta?.type !== 'comp' || !meta.id) return false;
  const hostMaster = registry.masterTypeIdForId(meta.id);
  if (hostMaster === undefined) return false;

  return registry.wouldCycle(hostMaster, placeDef.typeId);
}
