import { BuiltInComponentType } from '../model/component-type.enum';
import type {
  SerializedCircuitBody,
  SerializedComponentBody
} from '../model/serialized-circuit';
import { PLUG_OPTIONS } from './built-ins/input.meta';

/**
 * The port surface a circuit exposes when it is placed inside another one: how
 * many ports, and what each is called.
 *
 * The same three values a stored library component carries as columns, and the
 * same three an embedded {@link SnapshotDefinition} declares — which is why they
 * are derived here rather than asserted by whoever wrote the document. A
 * circuit's ports *are* the plugs placed in it; anything else is a claim about
 * them that can be wrong.
 */
export interface CircuitSummary {
  numInputs: number;
  numOutputs: number;
  /** One label per port, every input first, then every output, in port order. */
  labels: string[];
}

/**
 * Reads a circuit's port surface off the INPUT/OUTPUT plugs in its body.
 *
 * This is the data-side twin of the editor's live derivation, and the only place
 * on this side that knows the plug → port mapping. Ports are ordered by each
 * plug's `index` option and then by document order: the editor's Ports panel
 * always writes clean `0..n-1` indices, so duplicates and gaps only arise in
 * externally authored or legacy data, and the tiebreaker keeps this a total
 * order that never throws.
 */
export function deriveCircuitSummary(
  body: SerializedCircuitBody
): CircuitSummary {
  const inputs = plugsInPortOrder(body.components, BuiltInComponentType.INPUT);
  const outputs = plugsInPortOrder(
    body.components,
    BuiltInComponentType.OUTPUT
  );

  return {
    numInputs: inputs.length,
    numOutputs: outputs.length,
    labels: [...inputs, ...outputs].map(plugLabel)
  };
}

function plugsInPortOrder(
  components: readonly SerializedComponentBody[],
  type: BuiltInComponentType
): SerializedComponentBody[] {
  return components
    .filter((component) => component.type === type)
    .sort((a, b) => plugIndex(a) - plugIndex(b));
}

/**
 * A plug's position in its group. Absent or non-numeric reads as 0, which sorts
 * it to the front of the group and leaves document order to break the tie —
 * {@link deriveCircuitSummary} must answer for any parseable document, and a
 * document that omits the option is one the editor's own load path accepts.
 */
function plugIndex(component: SerializedComponentBody): number {
  const value = component.options[INDEX_OPTION];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function plugLabel(component: SerializedComponentBody): string {
  const value = component.options[LABEL_OPTION];
  return typeof value === 'string' ? value : '';
}

// Named through the plug meta so a renamed option breaks here rather than
// silently unlabelling every port.
const LABEL_OPTION: keyof typeof PLUG_OPTIONS = 'label';
const INDEX_OPTION: keyof typeof PLUG_OPTIONS = 'index';
