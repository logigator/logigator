import { Action } from './action';
import { ActionContainer } from './action-container';
import { SerializedAction } from './serialized-action.model';
import { AddComponentsAction } from './actions/add-components.action';
import { RemoveComponentsAction } from './actions/remove-components.action';
import { AddWiresAction } from './actions/add-wires.action';
import { RemoveWiresAction } from './actions/remove-wires.action';
import { MoveComponentsAction } from './actions/move-components.action';
import { MoveWiresAction } from './actions/move-wires.action';
import { ChangeOptionAction } from './actions/change-option.action';
import { TogglePortNegationAction } from './actions/toggle-port-negation.action';
import { deserializeMoveEntries } from './actions/move-entry.model';
import { LoggingService } from '../logging/logging.service';
import { getStaticDI } from '../utils/get-di';

/**
 * Reconstructs an {@link Action} from its `Action.serialize()` output — the read
 * side of the debug Project Dump format. The discriminated `type` maps back to a
 * concrete action; `ReorderPlugsAction`/`UpdateInstanceAction` collapse to a
 * plain {@link ActionContainer} (their behaviour is pure child delegation).
 */
export function deserializeAction(dto: SerializedAction): Action {
  switch (dto.type) {
    case 'addComponents':
      return new AddComponentsAction(...dto.components);
    case 'removeComponents':
      return new RemoveComponentsAction(...dto.components);
    case 'addWires':
      return new AddWiresAction(...dto.wires);
    case 'removeWires':
      return new RemoveWiresAction(...dto.wires);
    case 'moveComponents':
      return new MoveComponentsAction(...deserializeMoveEntries(dto.entries));
    case 'moveWires':
      return new MoveWiresAction(...deserializeMoveEntries(dto.entries));
    case 'changeOption':
      return new ChangeOptionAction(
        dto.componentId,
        dto.optionKey,
        dto.oldValue,
        dto.newValue
      );
    case 'togglePortNegation':
      return new TogglePortNegationAction(
        dto.componentId,
        dto.side,
        dto.index,
        dto.negated
      );
    case 'container':
      return new ActionContainer(...dto.actions.map(deserializeAction));
    default:
      // Unknown/future type from a malformed or newer dump: fail at parse time
      // rather than leaking `undefined` into the restored stack (which would
      // crash on the next undo/redo).
      getStaticDI(LoggingService).warn(
        `unknown serialized action type: ${(dto as { type?: string }).type}`,
        'ActionCodec'
      );
      throw new Error(
        `Unknown serialized action type: ${(dto as { type?: string }).type}`
      );
  }
}
