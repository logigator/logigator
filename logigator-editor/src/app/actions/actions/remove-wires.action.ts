import { Action } from '../action';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import { SerializedWire } from '../../wires/serialized-wire.model';
import { SerializedAction } from '../serialized-action.model';

export class RemoveWiresAction extends Action {
  private readonly _wires: SerializedWire[];

  constructor(...wires: Wire[]);
  constructor(...wires: SerializedWire[]);
  constructor(...wires: Wire[] | SerializedWire[]) {
    super();

    if (wires.length > 0 && wires[0] instanceof Wire) {
      this._wires = wires.map((wire) => Wire.serialize(wire as Wire));
    } else {
      this._wires = wires as SerializedWire[];
    }
  }

  serialize(): SerializedAction {
    return { type: 'removeWires', wires: this._wires };
  }

  do(project: Project): void {
    for (const wire of this._wires) {
      project.removeWire(wire.id);
    }
  }

  undo(project: Project): void {
    for (const wire of this._wires) {
      project.addWire(Wire.deserialize(wire));
    }
  }
}
