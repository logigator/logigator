import { ActionContainer } from '../action-container';
import { AddComponentsAction } from './add-components.action';
import { RemoveComponentsAction } from './remove-components.action';
import { Component } from '../../components/component';

/**
 * Brings a placed custom instance up to date — the **only** path by which a
 * placed instance's shape changes ([§G]). A frozen snapshot is never mutated;
 * instead the selected instance is **replaced** by a fresh instance of a new
 * snapshot type (taken from the master's current state) at the same
 * position/direction. Modelled as remove-then-add so it is undoable and dirties
 * the project; the add fires `portsChange$`, so the rebucket + integrator run in
 * this project only, exactly when the user asked.
 */
export class UpdateInstanceAction extends ActionContainer {
  constructor(oldInstance: Component, newInstance: Component) {
    super(
      new RemoveComponentsAction(oldInstance),
      new AddComponentsAction(newInstance)
    );
  }
}
