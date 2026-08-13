import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { ComponentProviderService } from '../components/component-provider.service';
import { Direction, SerializedCircuitBody } from '@logigator/core';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';

export function buildProject(components: Component[], wires: Wire[]): Project {
  const project = new Project();
  // Defer connection-point derivation: adding each element incrementally would
  // run one overlapping quad-tree query per element. Add them all, then derive
  // every dot in a single de-duplicated pass.
  for (const c of components) project.addComponent(c, true);
  for (const w of wires) project.addWire(w, true);
  project.recomputeConnectionPoints();
  return project;
}

/**
 * Negation indices from an untrusted body: keep only non-negative integers,
 * `undefined` when absent or not an array. Tolerant rather than throwing —
 * a stray index is harmless (rendering/compile ignore out-of-range), but a
 * non-array would otherwise crash the `for…of` in `Component.deserialize`.
 */
function sanitizeNegArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((i) => Number.isInteger(i) && i >= 0);
}

/**
 * Direction from an untrusted body: an integer quarter-turn 0–3, `undefined`
 * otherwise — a bogus value falls back to the constructed default (East)
 * instead of producing a nonsense rotation.
 */
function sanitizeDirection(value: unknown): Direction | undefined {
  return Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= 3
    ? (value as Direction)
    : undefined;
}

/** Instantiates a native body (session type ids) into editor objects.
 * Elements whose type does not resolve to a config are dropped with a
 * warning. */
export function instantiateBody(
  provider: ComponentProviderService,
  body: SerializedCircuitBody
): {
  components: Component[];
  wires: Wire[];
} {
  const components: Component[] = [];
  for (const c of body.components) {
    const config = provider.getComponent(c.type);
    if (config) {
      components.push(
        Component.deserialize(
          {
            pos: c.pos,
            direction: sanitizeDirection(c.direction),
            options: c.options,
            negInputs: sanitizeNegArray(c.negInputs),
            negOutputs: sanitizeNegArray(c.negOutputs)
          },
          config
        )
      );
    } else {
      getStaticDI(LoggingService).warn(
        `Dropped element with unresolved type ${c.type} at [${c.pos[0]}, ${c.pos[1]}]`,
        'circuit-builder'
      );
    }
  }
  const wires = body.wires.map((w) =>
    Wire.deserialize({ pos: w.pos, direction: w.direction, length: w.length })
  );
  return { components, wires };
}
