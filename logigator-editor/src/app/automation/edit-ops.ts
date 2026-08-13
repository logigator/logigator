/**
 * The automation write path: turns a batch of {@link EditOp}s into exactly one
 * undoable history entry, or into per-op errors with the project untouched.
 *
 * Two conventions from the drag sessions are load-bearing here:
 *
 * - **Materialize, then register.** Actions snapshot their payload in their
 *   constructors and `ActionManager.register` records them *without* running
 *   `do()`, so every op builds its actions first, mutates the live project with
 *   the actual instances, and the batch registers one {@link ActionContainer} at
 *   the end (`component-placement.session.ts` is the reference).
 * - **Wire integration.** Adding a component or a wire can split a wire whose
 *   interior gains a termination, and moving one can merge collinear pairs that
 *   lose one. Every such op runs `project.topology.integrate` and folds the
 *   resulting adds/removes into the same container, so undo restores the
 *   topology too.
 *
 * All-or-nothing is implemented by applying ops in order and, on the first
 * failure, undoing the container built so far. A pure dry run cannot work: a
 * later op's validity depends on where earlier ops in the same batch put
 * things, so anything short of applying them would have to simulate the whole
 * batch anyway. Nothing is registered unless every op succeeded, so a failed
 * batch leaves no history entry and no net state change.
 */

import { Point } from 'pixi.js';

import { ActionContainer } from '../actions/action-container';
import { AddComponentsAction } from '../actions/actions/add-components.action';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { ChangeOptionAction } from '../actions/actions/change-option.action';
import { MoveComponentsAction } from '../actions/actions/move-components.action';
import { MoveWiresAction } from '../actions/actions/move-wires.action';
import { RemoveComponentsAction } from '../actions/actions/remove-components.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { RotateComponentsAction } from '../actions/actions/rotate-components.action';
import { TogglePortNegationAction } from '../actions/actions/toggle-port-negation.action';
import { Component, PortSide } from '../components/component';
import { ComponentOption } from '../components/component-option';
import { ComponentProviderService } from '../components/component-provider.service';
import { wouldCyclePlacement } from '../components/custom/placement-cycle';
import { NO_EXCLUDED_IDS, Project } from '../project/project';
import { Direction, WireDirection } from '@logigator/core';
import { offsetRect } from '../utils/grid';
import {
  normalizeRotationSteps,
  rotatePointAroundPivot,
  rotateRectAroundPivot,
  rotationPivotFor
} from '../utils/rotation';
import { Wire } from '../wires/wire';
import { EditOp, EditResult, PerOpError } from './automation-api.model';
import { validateOptionValue } from './catalog';

export interface EditOpsContext {
  project: Project;
  provider: ComponentProviderService;
  /** Reported once per batch with what was committed. */
  debug: (message: string) => void;
}

/** A rejected op, thrown out of the apply loop to trigger the rollback. */
class EditOpError extends Error {
  constructor(
    public readonly index: number,
    public readonly op: string,
    message: string
  ) {
    super(message);
  }
}

const isInt = (value: unknown): boolean => Number.isInteger(value);

const isIntPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(isInt);

const isIndexArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every((v) => isInt(v) && (v as number) >= 0);

/**
 * Shape-only validation: everything checkable without reading the project, so a
 * malformed batch comes back with *every* bad op listed rather than just the
 * first one the apply loop trips over.
 */
function validateShape(op: EditOp): string | null {
  switch (op.op) {
    case 'addComponent':
      if (!isInt(op.type)) return 'type must be an integer type id';
      if (!isIntPair(op.pos)) return 'pos must be [x, y] on the integer grid';
      if (
        op.direction !== undefined &&
        (!isInt(op.direction) || op.direction < 0 || op.direction > 3)
      ) {
        return 'direction must be a quarter-turn 0–3';
      }
      if (
        op.options !== undefined &&
        (typeof op.options !== 'object' || op.options === null)
      ) {
        return 'options must be an object';
      }
      if (op.negInputs !== undefined && !isIndexArray(op.negInputs)) {
        return 'negInputs must be an array of port indices';
      }
      if (op.negOutputs !== undefined && !isIndexArray(op.negOutputs)) {
        return 'negOutputs must be an array of port indices';
      }
      return null;
    case 'addWire':
      if (!isIntPair(op.pos)) return 'pos must be [x, y] on the integer grid';
      if (
        op.direction !== WireDirection.HORIZONTAL &&
        op.direction !== WireDirection.VERTICAL
      ) {
        return 'direction must be 0 (horizontal) or 1 (vertical)';
      }
      if (!isInt(op.length) || op.length <= 0) {
        return 'length must be a positive integer';
      }
      return null;
    case 'remove':
      if (op.componentIds !== undefined && !isIndexArray(op.componentIds)) {
        return 'componentIds must be an array of ids';
      }
      if (op.wireIds !== undefined && !isIndexArray(op.wireIds)) {
        return 'wireIds must be an array of ids';
      }
      if (!op.componentIds?.length && !op.wireIds?.length) {
        return 'nothing to remove';
      }
      return null;
    case 'moveComponent':
    case 'moveWire':
      if (!isInt(op.id)) return 'id must be an element id';
      if (!isIntPair(op.to)) return 'to must be [x, y] on the integer grid';
      return null;
    case 'rotateComponent':
      if (!isInt(op.id)) return 'id must be an element id';
      if (!isInt(op.direction) || op.direction < 0 || op.direction > 3) {
        return 'direction must be a quarter-turn 0–3';
      }
      return null;
    case 'setOption':
      if (!isInt(op.id)) return 'id must be an element id';
      if (typeof op.key !== 'string' || op.key.length === 0) {
        return 'key must be an option key';
      }
      return null;
    case 'setPortNegation':
      if (!isInt(op.id)) return 'id must be an element id';
      if (op.side !== 'in' && op.side !== 'out') {
        return "side must be 'in' or 'out'";
      }
      if (!isInt(op.index) || op.index < 0) {
        return 'index must be a port index';
      }
      if (typeof op.negated !== 'boolean') return 'negated must be a boolean';
      return null;
    default:
      return `unknown op ${JSON.stringify((op as { op: unknown }).op)}`;
  }
}

/**
 * Applies a batch. Returns the created ids and the wires integration
 * split/merged on success; on failure the project is back to its pre-batch
 * state and no history entry was recorded.
 */
export function applyEditOps(
  ops: readonly EditOp[],
  context: EditOpsContext
): EditResult {
  const { project, provider } = context;

  const shapeErrors: PerOpError[] = [];
  ops.forEach((op, index) => {
    const message = validateShape(op);
    if (message) {
      shapeErrors.push({
        index,
        op: String((op as { op: unknown }).op),
        message
      });
    }
  });
  if (shapeErrors.length > 0) return { ok: false, errors: shapeErrors };

  const container = new ActionContainer();
  const createdIds: { index: number; componentId?: number; wireId?: number }[] =
    [];
  const integrated = { added: [] as number[], removed: [] as number[] };

  /** Materializes an integration result inside the batch's container. */
  const commitIntegration = (
    toAdd: readonly Wire[],
    toRemove: readonly Wire[],
    place: () => void
  ): void => {
    // Actions snapshot in their constructors, so every action is built while the
    // project still holds the pre-op state.
    if (toRemove.length > 0) {
      container.add(new RemoveWiresAction(...toRemove));
    }
    place();
    if (toAdd.length > 0) {
      container.add(new AddWiresAction(...toAdd));
    }
    for (const wire of toRemove) {
      integrated.removed.push(wire.id);
      project.removeWire(wire.id);
    }
    for (const wire of toAdd) {
      integrated.added.push(wire.id);
      project.addWire(wire);
    }
  };

  const resolveComponent = (
    index: number,
    op: string,
    id: number
  ): Component => {
    const component = project.getComponentById(id);
    if (!component) {
      throw new EditOpError(index, op, `no component with id ${id}`);
    }
    return component;
  };

  const resolveWire = (index: number, op: string, id: number): Wire => {
    const wire = project.getWireById(id);
    if (!wire) throw new EditOpError(index, op, `no wire with id ${id}`);
    return wire;
  };

  try {
    ops.forEach((op, index) => {
      switch (op.op) {
        case 'addComponent': {
          const config = provider.getComponent(op.type);
          if (!config) {
            throw new EditOpError(
              index,
              op.op,
              `unknown component type ${op.type}`
            );
          }
          const optionErrors = validateOptions(
            config.options,
            op.options ?? {}
          );
          if (optionErrors) throw new EditOpError(index, op.op, optionErrors);
          // The palette hides masters that would cycle; an agent can name any
          // type id, so the same guard applies here.
          if (wouldCyclePlacement(project, config)) {
            throw new EditOpError(
              index,
              op.op,
              `placing type ${op.type} here would close a dependency cycle`
            );
          }

          const component = Component.deserialize(
            {
              pos: op.pos,
              direction: op.direction as Direction | undefined,
              options: op.options ?? {},
              negInputs: op.negInputs,
              negOutputs: op.negOutputs
            },
            config
          );
          const collision = componentCollisionAt(
            project,
            component,
            new Point(0, 0)
          );
          if (collision) {
            component.destroy({ children: true });
            throw new EditOpError(index, op.op, collision);
          }

          // Splits any wire whose interior passes under one of the new ports.
          const { toAdd, toRemove } = project.topology.integrate({
            addedComponentPorts: component.connectionPoints
          });
          commitIntegration(toAdd, toRemove, () => {
            container.add(new AddComponentsAction(component));
            project.addComponent(component);
          });
          createdIds.push({ index, componentId: component.id });
          break;
        }

        case 'addWire': {
          const wire = Wire.deserialize({
            pos: op.pos,
            direction: op.direction,
            length: op.length
          });
          if (project.hasWireBodyCollision(wire.gridBounds)) {
            wire.destroy();
            throw new EditOpError(
              index,
              op.op,
              'the wire would cross a component body'
            );
          }
          // The drawn wire may itself be split or merged away; whatever comes
          // back from integration is what lands in the project.
          const { toAdd, toRemove } = project.topology.integrate({
            addedWires: [wire]
          });
          commitIntegration(toAdd, toRemove, () => undefined);
          if (!toAdd.includes(wire) && !wire.destroyed) {
            wire.destroy();
          }
          break;
        }

        case 'remove': {
          const components = (op.componentIds ?? []).map((id) =>
            resolveComponent(index, op.op, id)
          );
          const wires = (op.wireIds ?? []).map((id) =>
            resolveWire(index, op.op, id)
          );
          // Merges the collinear pair a removed third terminator (wire end or
          // component port) leaves behind; toRemove covers the requested wires
          // plus any neighbours those merges absorb. Materialized inline
          // rather than via commitIntegration so `integratedWires` reports
          // only the integrator's own effects, not the requested removals.
          const { toAdd, toRemove } = project.topology.integrate({
            removedWires: wires,
            removedComponentPorts: components.flatMap((c) => [
              ...c.connectionPoints
            ])
          });
          const requested = new Set(wires.map((w) => w.id));
          if (components.length > 0) {
            container.add(new RemoveComponentsAction(...components));
          }
          if (toRemove.length > 0) {
            container.add(new RemoveWiresAction(...toRemove));
          }
          if (toAdd.length > 0) {
            container.add(new AddWiresAction(...toAdd));
          }
          for (const component of components) {
            project.removeComponent(component.id);
          }
          for (const wire of toRemove) {
            if (!requested.has(wire.id)) integrated.removed.push(wire.id);
            project.removeWire(wire.id);
          }
          for (const wire of toAdd) {
            integrated.added.push(wire.id);
            project.addWire(wire);
          }
          break;
        }

        case 'moveComponent': {
          const component = resolveComponent(index, op.op, op.id);
          const oldPos = component.position.clone();
          const target = new Point(op.to[0], op.to[1]);
          const delta = new Point(target.x - oldPos.x, target.y - oldPos.y);
          const collision = componentCollisionAt(project, component, delta);
          if (collision) throw new EditOpError(index, op.op, collision);

          const oldPorts = component.connectionPoints;
          container.add(
            new MoveComponentsAction({
              id: component.id,
              oldPos,
              newPos: target
            })
          );
          project.moveComponent(component.id, target);
          const { toAdd, toRemove } = project.topology.integrate({
            movedComponentPorts: [
              { oldPorts, newPorts: component.connectionPoints }
            ]
          });
          commitIntegration(toAdd, toRemove, () => undefined);
          break;
        }

        case 'moveWire': {
          const wire = resolveWire(index, op.op, op.id);
          const oldPos = wire.position.clone();
          // Wire bodies are stored on the integer grid and live on the
          // half-grid lattice — the same +0.5 convention as `Wire.deserialize`.
          const target = new Point(op.to[0] + 0.5, op.to[1] + 0.5);
          const delta = new Point(target.x - oldPos.x, target.y - oldPos.y);
          if (
            project.hasWireBodyCollision(
              offsetRect(wire.gridBounds, delta),
              new Set([wire.id])
            )
          ) {
            throw new EditOpError(
              index,
              op.op,
              'the wire would cross a component body'
            );
          }
          const oldSnapshot = Wire.snapshot(wire);
          container.add(
            new MoveWiresAction({ id: wire.id, oldPos, newPos: target })
          );
          project.moveWire(wire.id, target);
          const { toAdd, toRemove } = project.topology.integrate({
            movedWires: [{ wire, oldSnapshot }]
          });
          commitIntegration(toAdd, toRemove, () => undefined);
          break;
        }

        case 'rotateComponent': {
          const component = resolveComponent(index, op.op, op.id);
          const newDirection = op.direction as Direction;
          const steps = normalizeRotationSteps(
            newDirection - component.direction
          );
          if (steps === 0) break;

          // Turned around its own footprint's pivot, exactly like a
          // single-element selection rotate: the body stays put instead of
          // swinging off its corner (the direction setter's own re-anchoring is
          // overridden by the orbited position).
          const pivot = rotationPivotFor(component.gridBounds);
          const newPos = rotatePointAroundPivot(
            pivot,
            component.position,
            steps
          );
          const rotatedBounds = rotateRectAroundPivot(
            pivot,
            component.gridBounds,
            steps
          );
          const rotatedBody = rotateRectAroundPivot(
            pivot,
            component.bodyGridBounds,
            steps
          );
          if (
            project.hasComponentCollision(
              rotatedBounds,
              rotatedBody,
              new Set([component.id])
            ) ||
            project.hasComponentBodyWireCollision(
              rotatedBody,
              NO_EXCLUDED_IDS,
              component.ignoresWireCollision
            )
          ) {
            throw new EditOpError(
              index,
              op.op,
              'the rotated component would collide'
            );
          }

          const oldPorts = component.connectionPoints;
          container.add(
            new RotateComponentsAction({
              id: component.id,
              oldPos: component.position.clone(),
              newPos,
              oldDirection: component.direction,
              newDirection
            })
          );
          // rotateComponent unindexes around the direction write, so the
          // project's automatic (non-undoable) integration stays out of the way
          // and the container below owns the wire changes.
          project.rotateComponent(component.id, newDirection, newPos);
          const { toAdd, toRemove } = project.topology.integrate({
            movedComponentPorts: [
              { oldPorts, newPorts: component.connectionPoints }
            ]
          });
          commitIntegration(toAdd, toRemove, () => undefined);
          break;
        }

        case 'setOption': {
          const component = resolveComponent(index, op.op, op.id);
          const option = component.options[op.key];
          if (!option) {
            throw new EditOpError(
              index,
              op.op,
              `component ${op.id} has no option "${op.key}"`
            );
          }
          const message = validateOptionValue(option, op.value);
          if (message) {
            throw new EditOpError(
              index,
              op.op,
              `option "${op.key}": ${message}`
            );
          }
          const action = new ChangeOptionAction(
            component.id,
            op.key,
            option.value,
            op.value
          );
          // A change-option's materialization *is* its do(); registering the
          // container afterwards never re-runs it.
          action.do(project);
          container.add(action);
          break;
        }

        case 'setPortNegation': {
          const component = resolveComponent(index, op.op, op.id);
          const count =
            op.side === 'in' ? component.numInputs : component.numOutputs;
          if (op.index >= count) {
            throw new EditOpError(
              index,
              op.op,
              `${op.side} port ${op.index} is out of range (${count} ports)`
            );
          }
          const action = new TogglePortNegationAction(
            component.id,
            op.side as PortSide,
            op.index,
            op.negated
          );
          action.do(project);
          container.add(action);
          break;
        }
      }
    });
  } catch (err) {
    // Undo whatever landed so the caller's "nothing was committed" holds. The
    // container was never registered, so the history is untouched either way.
    container.undo(project);
    if (err instanceof EditOpError) {
      return {
        ok: false,
        errors: [{ index: err.index, op: err.op, message: err.message }]
      };
    }
    throw err;
  }

  if (container.length > 0) {
    project.actionManager.register(container);
    // Most project mutations request their own frame, but the two that only
    // rebuild a component's visuals (an option write, a negation toggle) rely on
    // the enclosing gesture's ticker — which a programmatic batch has not got.
    project.triggerTicker('single');
  }
  context.debug(
    `applied ${ops.length} op(s) as ${container.length} action(s); ` +
      `integration added ${integrated.added.length} and removed ${integrated.removed.length} wire(s)`
  );
  return { ok: true, createdIds, integratedWires: integrated };
}

/**
 * Why placing `component` shifted by `delta` collides, or `null`. Mirrors the
 * drag sessions' predicate (`DragCollisionState`): body-on-body and body-on-stub
 * overlap block, stub-on-stub does not.
 */
function componentCollisionAt(
  project: Project,
  component: Component,
  delta: Point
): string | null {
  const exclude = new Set([component.id]);
  if (
    project.hasComponentCollision(
      offsetRect(component.gridBounds, delta),
      offsetRect(component.bodyGridBounds, delta),
      exclude
    )
  ) {
    return 'the component would overlap another component';
  }
  if (
    project.hasComponentBodyWireCollision(
      offsetRect(component.bodyGridBounds, delta),
      exclude,
      component.ignoresWireCollision
    )
  ) {
    return 'the component body would cover a wire';
  }
  return null;
}

/** Every unknown option key, plus every value the option model rejects. */
function validateOptions(
  prototypes: Record<string, ComponentOption>,
  values: Record<string, unknown>
): string | null {
  const problems: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const option = prototypes[key];
    if (!option) {
      problems.push(`unknown option "${key}"`);
      continue;
    }
    const message = validateOptionValue(option, value);
    if (message) problems.push(`option "${key}": ${message}`);
  }
  return problems.length > 0 ? problems.join('; ') : null;
}
