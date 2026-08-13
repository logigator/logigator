import { Component } from '../../components/component';
import { BuiltInComponentType } from '@logigator/core';
import { Project } from '../../project/project';
import { SimulationService } from '../../simulation/simulation.service';
import { extractNets, Net } from '../../simulation/compiler/net-extractor';
import { TOP_LEVEL_PATH } from '../../simulation/compiler/compiled-board.model';
import { TutorialContext } from '../tutorial.model';

const AND = BuiltInComponentType.AND;
const SWITCH = BuiltInComponentType.SWITCH;
const LED = BuiltInComponentType.LED;

/** How many components of `type` the user has placed since the step started. */
export function placedSince(ctx: TutorialContext, type: number): number {
  return Math.max(
    0,
    currentCount(ctx.project, type) - (ctx.baseline.get(type) ?? 0)
  );
}

/** Total components placed since the step started (any type). */
export function placedTotalSince(ctx: TutorialContext): number {
  let baselineTotal = 0;
  for (const count of ctx.baseline.values()) baselineTotal += count;
  return Math.max(0, ctx.project.componentCount - baselineTotal);
}

function currentCount(project: Project, type: number): number {
  let count = 0;
  for (const component of project.components) {
    if (component.config.type === type) count++;
  }
  return count;
}

function firstOfType(project: Project, type: number): Component | null {
  for (const component of project.components) {
    if (component.config.type === type) return component;
  }
  return null;
}

/**
 * Whether the canonical two-Switch → AND → LED circuit is wired: the AND's
 * output shares a net with an LED input, and each of its two inputs is driven by
 * a distinct Switch output. Uses the compiler's own net extraction (union-find
 * over termination points), so any wiring path that forms the nets counts — a
 * port is an output when its index is `>= component.numInputs` (a Switch has no
 * inputs, so all its ports are outputs).
 *
 * The per-input matching matters: both switches wired to a single AND input
 * (the other left floating) would keep the AND output low forever, so it must
 * not count as complete.
 */
export function netComplete(project: Project): boolean {
  const and = firstOfType(project, AND);
  const led = firstOfType(project, LED);
  if (!and || !led) return false;

  const nets = extractNets({
    components: project.components,
    wires: project.wires
  });
  const netOfPort = (
    component: Component,
    portIndex: number
  ): Net | undefined =>
    nets.find((net) =>
      net.ports.some(
        (port) => port.component === component && port.portIndex === portIndex
      )
    );

  const outputReachesLed = anyPort(and, 'out', (portIndex) => {
    const net = netOfPort(and, portIndex);
    return (
      !!net &&
      net.ports.some(
        (port) =>
          port.component.config.type === LED &&
          port.portIndex < port.component.numInputs
      )
    );
  });
  if (!outputReachesLed) return false;

  // The switch(es) reachable from each AND input, kept separate per input so a
  // matching can assign a distinct switch to distinct inputs.
  const switchesPerInput: Component[][] = [];
  for (let portIndex = 0; portIndex < and.numInputs; portIndex++) {
    const net = netOfPort(and, portIndex);
    switchesPerInput.push(
      net
        ? net.ports
            .filter(
              (port) =>
                port.component.config.type === SWITCH &&
                port.portIndex >= port.component.numInputs
            )
            .map((port) => port.component)
        : []
    );
  }
  return distinctMatchCount(switchesPerInput) >= 2;
}

/**
 * Maximum number of AND inputs that can each be paired with a *different* switch
 * (bipartite matching, Kuhn's algorithm). Two switches sharing one input net
 * therefore only satisfy one input, not both.
 */
function distinctMatchCount(
  switchesPerInput: readonly (readonly Component[])[]
): number {
  const switchToInput = new Map<Component, number>();
  const assign = (input: number, seen: Set<Component>): boolean => {
    for (const sw of switchesPerInput[input]) {
      if (seen.has(sw)) continue;
      seen.add(sw);
      const holder = switchToInput.get(sw);
      if (holder === undefined || assign(holder, seen)) {
        switchToInput.set(sw, input);
        return true;
      }
    }
    return false;
  };
  let matched = 0;
  for (let input = 0; input < switchesPerInput.length; input++) {
    if (assign(input, new Set())) matched++;
  }
  return matched;
}

function anyPort(
  component: Component,
  side: 'in' | 'out',
  test: (portIndex: number) => boolean
): boolean {
  const total = component.connectionPoints.length;
  const from = side === 'in' ? 0 : component.numInputs;
  const to = side === 'in' ? component.numInputs : total;
  for (let portIndex = from; portIndex < to; portIndex++) {
    if (test(portIndex)) return true;
  }
  return false;
}

/**
 * Whether an LED input link is currently powered in the running simulation —
 * read from the top-level link → render mapping and the live link applier, so
 * the step only completes once the user has actually seen the LED light.
 */
export function ledPowered(sim: SimulationService): boolean {
  const board = sim.board;
  const applier = sim.applier;
  if (!board || !applier) return false;
  const targets = board.mapping.get(TOP_LEVEL_PATH);
  if (!targets) return false;
  for (let linkId = 0; linkId < targets.length; linkId++) {
    const hitsLed = targets[linkId].ports.some(
      (port) =>
        port.component.config.type === LED &&
        port.portIndex < port.component.numInputs
    );
    if (hitsLed && applier.isPowered(linkId)) return true;
  }
  return false;
}
