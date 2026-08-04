import { Project } from '../project/project';
import { InputComponent } from '../components/component-types/input/input.component';
import { OutputComponent } from '../components/component-types/output/output.component';

export interface DerivedSummary {
  numInputs: number;
  numOutputs: number;
  /** Port labels, all inputs first then all outputs, in plug order. */
  labels: string[];
}

/**
 * Derives a custom component's port summary from the INPUT/OUTPUT plugs placed
 * in its circuit — the **only** place that knows the plug → port mapping. Both
 * the live editor binding and the save path use it.
 *
 * Ports are ordered by each plug's `index` option, then by instance id as a
 * defensive tiebreaker: the Ports panel always writes clean `0..n-1` indices, so
 * duplicate/gappy values never arise from in-app editing, but externally-authored
 * or legacy data might contain them. This stays a total order and never throws.
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

  const byOrder = (
    a: InputComponent | OutputComponent,
    b: InputComponent | OutputComponent
  ): number => a.options.index.value - b.options.index.value || a.id - b.id;

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
