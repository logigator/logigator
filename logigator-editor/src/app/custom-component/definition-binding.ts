import { auditTime, Subscription } from 'rxjs';
import { Project } from '../project/project';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { serializeProjectBody } from '../persistence/snapshots';
import { deriveSummary } from './definition-derivation';

/**
 * Keeps a custom master's summary in sync with its open editor Project, one
 * binding per editor. Every plug change — add, remove, label edit, index
 * reorder — flows through `ActionManager`, so one `actionChange$` listener
 * coalesced with `auditTime(0)` is enough.
 *
 * Only the master definition is touched; placed snapshots are frozen, so
 * editing a master never changes already-placed instances.
 */
export class DefinitionBinding {
  private readonly _sub: Subscription;

  constructor(
    private readonly project: Project,
    private readonly masterTypeId: number,
    private readonly registry: CustomComponentRegistry
  ) {
    this._sub = project.actionManager.actionChange$
      .pipe(auditTime(0))
      .subscribe(() => this._recompute());
    this._recompute();
  }

  private _recompute(): void {
    const summary = deriveSummary(this.project);
    this.registry.updateDefinition(this.masterTypeId, summary);

    // Materialising the circuit lets snapshots capture the current contents,
    // and recomputes the master's library dependencies for cycle prevention.
    this.registry.setMasterCircuit(
      this.masterTypeId,
      serializeProjectBody(this.project)
    );
  }

  public dispose(): void {
    this._sub.unsubscribe();
  }
}
