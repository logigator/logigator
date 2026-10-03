import { Project } from '../project/project';
import { InputComponent } from '../components/component-types/input/input.component';
import { OutputComponent } from '../components/component-types/output/output.component';
import { Component } from '../components/component';

export interface DerivedSummary {
  numInputs: number;
  numOutputs: number;
  /** Port labels, all inputs first then all outputs, in plug order. */
  labels: string[];
}

type Plug = InputComponent | OutputComponent;

const byOrder = (a: Plug, b: Plug): number =>
  a.options.index.value - b.options.index.value || a.id - b.id;

/**
 * A custom component's port summary from the INPUT/OUTPUT plugs in its circuit
 * — the only place that knows the plug → port mapping.
 *
 * Ports are ordered by each plug's `index` option, then by instance id: the
 * Ports panel writes clean `0..n-1` indices, but externally-authored data may
 * have duplicates or gaps, and this stays a total order regardless.
 */
export function deriveSummary(project: Project): DerivedSummary {
  const inputs: InputComponent[] = [];
  const outputs: OutputComponent[] = [];

  for (const component of project.components) {
    if (component instanceof InputComponent) {
      inputs.push(component);
    } else if (component instanceof OutputComponent) {
      outputs.push(component);
    }
  }

  inputs.sort(byOrder);
  outputs.sort(byOrder);

  return {
    numInputs: inputs.length,
    numOutputs: outputs.length,
    labels: [
      ...inputs.map((c) => c.options.label.value),
      ...outputs.map((c) => c.options.label.value)
    ]
  };
}

/**
 * Numbers plugs about to join `project` after the ones it already holds, so
 * a placed or pasted plug becomes the last port of its kind. Among `added`,
 * their existing order is kept. Call before the adding action snapshots them.
 */
export function appendPlugIndices(
  project: Project,
  added: readonly Component[]
): void {
  for (const ctor of [InputComponent, OutputComponent]) {
    const incoming = added.filter((c): c is Plug => c instanceof ctor);
    if (incoming.length === 0) continue;

    let next = 0;
    for (const component of project.components) {
      if (component instanceof ctor) {
        next = Math.max(next, component.options.index.value + 1);
      }
    }
    for (const plug of incoming.sort(byOrder)) {
      plug.options.index.value = next++;
    }
  }
}
