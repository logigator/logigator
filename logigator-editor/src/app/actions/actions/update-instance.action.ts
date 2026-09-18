import { ActionContainer } from '../action-container';
import { AddComponentsAction } from './add-components.action';
import { RemoveComponentsAction } from './remove-components.action';
import { Component } from '../../components/component';

/**
 * The only path by which a placed custom instance's shape changes. Frozen
 * snapshots are never mutated: the instance is replaced by a fresh one of a new
 * snapshot type, at the same position and direction. Remove-then-add keeps it
 * undoable, and the add fires `portsChange$` so the rebucket and integrator run
 * in this project alone.
 */
export class UpdateInstanceAction extends ActionContainer {
  constructor(oldInstance: Component, newInstance: Component) {
    super(
      new RemoveComponentsAction(oldInstance),
      new AddComponentsAction(newInstance)
    );
  }
}
