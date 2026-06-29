import { auditTime, Subscription } from 'rxjs';
import { Project } from '../project/project';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { serializeProjectBody } from '../persistence/snapshots';
import { deriveSummary } from './definition-derivation';

/**
 * Keeps a custom **master**'s summary in sync with its open editor Project. One
 * binding per open component editor.
 *
 * Every plug change — add/remove ({@link AddComponentsAction}/Remove), label edit
 * and index reorder (both {@link ChangeOptionAction}) — flows through
 * `ActionManager`, so a single `actionChange$` listener (coalesced with
 * `auditTime(0)`) is enough. On each change it re-derives `{numInputs, numOutputs,
 * labels}` and pushes it to the master via `updateDefinition`, materialises the
 * master's circuit (so snapshots capture the current contents), and recomputes the
 * master's direct library dependencies (the distinct masters its placed snapshots
 * came from) for cycle prevention.
 *
 * It only ever touches the **master** definition; placed snapshots are frozen and
 * untouched, so editing a master never changes already-placed instances.
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

    // Materialise the master's circuit so a snapshot taken at place/update time
    // carries the current contents. Snapshots deep-copy it, so this never
    // touches already-placed frozen instances. `setMasterCircuit` also recomputes
    // the master's library dependencies from the circuit (for cycle prevention).
    this.registry.setMasterCircuit(
      this.masterTypeId,
      serializeProjectBody(this.project)
    );
  }

  public dispose(): void {
    this._sub.unsubscribe();
  }
}
