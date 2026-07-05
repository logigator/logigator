import { Point } from 'pixi.js';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { BuiltInComponentType } from '../../components/component-type.enum';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { SerializedCircuitBody } from '../../persistence/serialized-circuit';
import { Project } from '../../project/project';
import { getStaticDI } from '../../utils/get-di';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';

/**
 * Debug-menu fixture for exercising the custom-component watch without
 * hand-building circuits: registers two snapshot definitions — `BLINK`, a NOT
 * oscillator whose inner wires flip every engine tick, and `NEST`, which
 * embeds a BLINK next to an inner lever — and places a NEST instance into the
 * active project. Enter simulation and tap the instance to open its watch.
 */

function wireBetween(
  a: { x: number; y: number },
  b: { x: number; y: number }
): Wire {
  const horizontal = a.y === b.y;
  const wire = new Wire(
    horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
    horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
  );
  wire.position.set(Math.min(a.x, b.x), Math.min(a.y, b.y));
  return wire;
}

/** Serializes live elements into a snapshot circuit body, destroying them. */
function liveToBody(
  components: Component[],
  wires: Wire[]
): SerializedCircuitBody {
  const body: SerializedCircuitBody = {
    components: components.map((component) => {
      const serialized = Component.serialize(component);
      return {
        type: serialized.type,
        pos: serialized.pos,
        options: serialized.options
      };
    }),
    wires: wires.map((wire) => {
      const serialized = Wire.serialize(wire);
      return {
        pos: serialized.pos,
        direction: serialized.direction,
        length: serialized.length
      };
    })
  };
  components.forEach((component) => component.destroy({ children: true }));
  wires.forEach((wire) => wire.destroy());
  return body;
}

export function insertWatchDemoCircuit(project: Project): void {
  const provider = getStaticDI(ComponentProviderService);
  const registry = getStaticDI(CustomComponentRegistry);

  const place = (type: number, pos: [number, number]): Component =>
    Component.deserialize(
      { pos, options: { direction: 0 } },
      provider.getComponent(type)!
    );
  const plug = (
    kind: BuiltInComponentType.INPUT | BuiltInComponentType.OUTPUT,
    index: number,
    pos: [number, number]
  ): Component =>
    Component.deserialize(
      { pos, options: { label: '', index } },
      provider.getComponent(kind)!
    );

  // BLINK: a NOT feeding itself back — oscillates at engine tick rate.
  const not = place(BuiltInComponentType.NOT, [0, 0]);
  const blinkOut = plug(BuiltInComponentType.OUTPUT, 0, [8, 0]);
  const notIn = not.connectionPoints[0];
  const notOut = not.connectionPoints[1];
  const dropY = notIn.y + 3;
  const blink = registry.registerSnapshot({
    kind: 'snapshot',
    source: 'browser',
    name: 'Blink',
    symbol: 'BLK',
    description: 'NOT oscillator (watch demo)',
    numInputs: 0,
    numOutputs: 1,
    labels: ['O'],
    circuit: liveToBody(
      [not, blinkOut],
      [
        wireBetween(notOut, blinkOut.connectionPoints[0]),
        wireBetween(notOut, new Point(notOut.x, dropY)),
        wireBetween(new Point(notOut.x, dropY), new Point(notIn.x, dropY)),
        wireBetween(new Point(notIn.x, dropY), notIn)
      ]
    )
  });

  // NEST: an inner lever and a nested BLINK, ANDed onto the single output.
  const lever = place(BuiltInComponentType.LEVER, [0, 0]);
  const inner = place(blink, [0, 4]);
  const and = place(BuiltInComponentType.AND, [8, 0]);
  const nestOut = plug(BuiltInComponentType.OUTPUT, 0, [14, 0]);
  const leverOut = lever.connectionPoints[0];
  const innerOut = inner.connectionPoints[0];
  const andIn0 = and.connectionPoints[0];
  const andIn1 = and.connectionPoints[1];
  const corner = new Point(innerOut.x + 1, innerOut.y);
  const nest = registry.registerSnapshot({
    kind: 'snapshot',
    source: 'browser',
    name: 'Nest',
    symbol: 'NST',
    description: 'lever + nested Blink (watch demo)',
    numInputs: 0,
    numOutputs: 1,
    labels: ['O'],
    circuit: liveToBody(
      [lever, inner, and, nestOut],
      [
        wireBetween(leverOut, andIn0),
        wireBetween(innerOut, corner),
        wireBetween(corner, new Point(corner.x, andIn1.y)),
        wireBetween(new Point(corner.x, andIn1.y), andIn1),
        wireBetween(and.connectionPoints[2], nestOut.connectionPoints[0])
      ]
    )
  });

  // The placed instance plus a short wire off its output stub.
  const instance = place(nest, [10, 10]);
  project.addComponent(instance);
  const out = instance.connectionPoints[0];
  project.addWire(wireBetween(out, new Point(out.x + 4, out.y)));
  project.triggerTicker('single');
}
