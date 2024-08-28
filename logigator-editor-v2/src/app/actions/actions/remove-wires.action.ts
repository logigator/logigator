import { Action } from '../action';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import { SerializedWire } from '../../wires/serialized-wire.model';

export class RemoveWiresAction extends Action {
	private readonly _wires: SerializedWire[];

	constructor(...wires: Wire[]) {
		super();
		this._wires = wires.map((wire) => Wire.serialize(wire));
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
