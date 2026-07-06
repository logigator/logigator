import { beforeEach, describe, expect, it } from 'vitest';
import { Point } from 'pixi.js';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { BuiltInComponentType } from '../components/component-type.enum';
import { ComponentProviderService } from '../components/component-provider.service';
import { buildProject, instantiateBody } from './circuit-builder';
import { SerializedCircuitBody } from './serialized-circuit';
import { WireDirection } from '../wires/wire-direction.enum';
import { makeWire } from '../../testing/factories';

// The simulation watch tables are keyed by element position in the body
// arrays: the compiler records against one instantiateBody run and a watch
// session addresses another. This pins the shared contract — output order
// matches body array order, for components and wires alike.
describe('instantiateBody order contract', () => {
  let provider: ComponentProviderService;

  beforeEach(() => {
    configureTestBed();
    provider = TestBed.inject(ComponentProviderService);
  });

  it('instantiates components and wires in body array order', () => {
    const body: SerializedCircuitBody = {
      components: [
        { type: BuiltInComponentType.SWITCH, pos: [0, 0], options: {} },
        { type: BuiltInComponentType.AND, pos: [4, 0], options: {} },
        { type: BuiltInComponentType.NOT, pos: [10, 0], options: {} },
        { type: BuiltInComponentType.BUTTON, pos: [0, 6], options: {} }
      ],
      wires: [
        { pos: [2, 0], direction: 0, length: 2 },
        { pos: [8, 0], direction: 1, length: 3 },
        { pos: [2, 6], direction: 0, length: 4 }
      ]
    };

    const { components, wires } = instantiateBody(provider, body);

    expect(components.map((c) => c.config.type)).toEqual(
      body.components.map((c) => c.type)
    );
    components.forEach((component, i) => {
      expect([component.position.x, component.position.y]).toEqual(
        body.components[i].pos
      );
    });
    wires.forEach((wire, i) => {
      // Deserialization adds the half-grid centre-line offset to the stored
      // integer position.
      expect([wire.position.x, wire.position.y]).toEqual([
        body.wires[i].pos[0] + 0.5,
        body.wires[i].pos[1] + 0.5
      ]);
      expect(wire.length).toEqual(body.wires[i].length);
    });

    components.forEach((c) => c.destroy({ children: true }));
    wires.forEach((w) => w.destroy());
  });
});

// buildProject adds every element with connection-point derivation deferred,
// then derives all dots in a single pass. This pins that the batched result
// matches the incremental one: a 3-wire T-junction still produces its CP.
describe('buildProject connection-point derivation', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('derives the T-junction CP after a deferred batch load', () => {
    const wires = [
      makeWire(0, 2, WireDirection.HORIZONTAL, 2),
      makeWire(2, 2, WireDirection.HORIZONTAL, 3),
      makeWire(2, 0, WireDirection.VERTICAL, 2)
    ];

    const project = buildProject([], wires);

    expect(project.connectionPoints.hasCpAt(new Point(2.5, 2.5))).toBe(true);

    project.destroy({ children: true });
  });
});
