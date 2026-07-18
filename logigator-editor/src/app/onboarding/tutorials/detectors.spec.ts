import { describe, expect, it } from 'vitest';
import { Component } from '../../components/component';
import { BuiltInComponentType } from '../../components/component-type.enum';
import { Project } from '../../project/project';
import { SimulationService } from '../../simulation/simulation.service';
import { TOP_LEVEL_PATH } from '../../simulation/compiler/compiled-board.model';
import { TutorialContext } from '../tutorial.model';
import {
  ledPowered,
  netComplete,
  placedSince,
  placedTotalSince
} from './detectors';

interface Pt {
  x: number;
  y: number;
}

/** Minimal component honoring the fields extractNets/detectors read. */
function fakeComponent(
  type: number,
  numInputs: number,
  points: Pt[]
): Component {
  return {
    config: { type },
    numInputs,
    connectionPoints: points
  } as unknown as Component;
}

function fakeWire(a: Pt, b: Pt) {
  return { connectionPoints: [a, b] };
}

function projectOf(components: Component[], wires: unknown[] = []): Project {
  return { components, wires } as unknown as Project;
}

function contextOf(
  components: Component[],
  baseline: Map<number, number>
): TutorialContext {
  return {
    project: projectOf(components),
    baseline,
    sim: {} as SimulationService,
    userInteracted: false
  };
}

const SW = BuiltInComponentType.SWITCH;
const AND = BuiltInComponentType.AND;
const LED = BuiltInComponentType.LED;

describe('tutorial detectors', () => {
  describe('placedSince / placedTotalSince', () => {
    it('counts only what was added after the baseline', () => {
      const ctx = contextOf(
        [
          fakeComponent(AND, 2, []),
          fakeComponent(SW, 0, []),
          fakeComponent(SW, 0, [])
        ],
        new Map([[SW, 1]]) // one switch existed at step entry
      );
      expect(placedSince(ctx, SW)).toBe(1);
      expect(placedSince(ctx, AND)).toBe(1);
      expect(placedSince(ctx, LED)).toBe(0);
      expect(placedTotalSince(ctx)).toBe(2); // 3 now, 1 at baseline
    });
  });

  describe('netComplete', () => {
    // Two switches wired to the AND's two inputs; the AND's output wired to the
    // LED's input — the canonical circuit.
    function wiredCircuit() {
      const sw1 = fakeComponent(SW, 0, [{ x: 0, y: 0 }]);
      const sw2 = fakeComponent(SW, 0, [{ x: 0, y: 2 }]);
      const and = fakeComponent(AND, 2, [
        { x: 5, y: 0 }, // input 0
        { x: 5, y: 2 }, // input 1
        { x: 7, y: 1 } // output
      ]);
      const led = fakeComponent(LED, 1, [{ x: 10, y: 1 }]);
      const wires = [
        fakeWire({ x: 0, y: 0 }, { x: 5, y: 0 }),
        fakeWire({ x: 0, y: 2 }, { x: 5, y: 2 }),
        fakeWire({ x: 7, y: 1 }, { x: 10, y: 1 })
      ];
      return { sw1, sw2, and, led, wires };
    }

    it('is true for two switches → AND → LED fully wired', () => {
      const c = wiredCircuit();
      expect(
        netComplete(projectOf([c.sw1, c.sw2, c.and, c.led], c.wires))
      ).toBe(true);
    });

    it('is false when the AND output does not reach the LED', () => {
      const c = wiredCircuit();
      const wires = c.wires.slice(0, 2); // drop the AND→LED wire
      expect(netComplete(projectOf([c.sw1, c.sw2, c.and, c.led], wires))).toBe(
        false
      );
    });

    it('is false when only one switch is wired to the gate', () => {
      const c = wiredCircuit();
      const wires = [c.wires[0], c.wires[2]]; // drop switch 2's wire
      expect(netComplete(projectOf([c.sw1, c.sw2, c.and, c.led], wires))).toBe(
        false
      );
    });
  });

  describe('ledPowered', () => {
    function simWith(
      ledPortIndex: number,
      powered: boolean
    ): SimulationService {
      const led = fakeComponent(LED, 1, [{ x: 0, y: 0 }]);
      const targets = [
        { wires: [], ports: [{ component: led, portIndex: ledPortIndex }] }
      ];
      return {
        board: { mapping: new Map([[TOP_LEVEL_PATH, targets]]) },
        applier: { isPowered: (id: number) => powered && id === 0 }
      } as unknown as SimulationService;
    }

    it('is true when the LED input link is powered', () => {
      expect(ledPowered(simWith(0, true))).toBe(true);
    });

    it('is false when the LED link is unpowered', () => {
      expect(ledPowered(simWith(0, false))).toBe(false);
    });

    it('ignores a powered LED output link (only inputs count)', () => {
      // portIndex 1 >= numInputs(1): an output, not the input we light on.
      expect(ledPowered(simWith(1, true))).toBe(false);
    });

    it('is false before a simulation session exists', () => {
      expect(
        ledPowered({ board: null, applier: null } as SimulationService)
      ).toBe(false);
    });
  });
});
