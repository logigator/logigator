import { ActionContainer } from '../action-container';
import { AddComponentsAction } from './add-components.action';
import { RemoveComponentsAction } from './remove-components.action';
import { Component } from '../../components/component';

/**
 * Brings a placed custom instance up to date — the **only** path by which a
 * placed instance's shape changes. Frozen snapshots are never mutated; the
 * selected instance is **replaced** by a fresh instance of a new snapshot type
 * (from the master's current state) at the same position/direction.
 * Remove-then-add makes it undoable and dirties the project; the add fires
 * `portsChange$`, so the rebucket + integrator run in this project only, when
 * the user asked.
 */
export class UpdateInstanceAction extends ActionContainer {
  constructor(oldInstance: Component, newInstance: Component) {
    super(
      new RemoveComponentsAction(oldInstance),
      new AddComponentsAction(newInstance)
    );
  }
}
