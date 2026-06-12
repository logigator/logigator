import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { ComponentProviderService } from '../components/component-provider.service';
import { SerializedCircuitBody } from './serialized-circuit';

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
        Component.deserialize({ pos: c.pos, options: c.options }, config)
      );
    }
  }
  const wires = body.wires.map((w) =>
    Wire.deserialize({ pos: w.pos, direction: w.direction, length: w.length })
  );
  return { components, wires };
}
