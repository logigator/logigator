import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { ComponentProviderService } from '../components/component-provider.service';
import { SerializedCircuitBody } from './serialized-circuit';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';

export function buildProject(components: Component[], wires: Wire[]): Project {
  const project = new Project();
  for (const c of components) project.addComponent(c);
  for (const w of wires) project.addWire(w);
  return project;
}

/** Instantiates a native body (session type ids) into editor objects. */
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
            options: c.options,
            negInputs: c.negInputs,
            negOutputs: c.negOutputs
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
