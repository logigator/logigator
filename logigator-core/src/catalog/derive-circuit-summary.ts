import { BuiltInComponentType } from '../model/component-type.enum';
import type {
  SerializedCircuitBody,
  SerializedComponentBody
} from '../model/serialized-circuit';
import { PLUG_OPTIONS } from './built-ins/input.meta';

/**
 * The port surface a circuit exposes when placed inside another one. Derived
 * rather than taken from the document: a circuit's ports are the plugs placed
 * in it, and anything else is a claim about them that can be wrong.
 */
export interface CircuitSummary {
  numInputs: number;
  numOutputs: number;
  /** One label per port, every input first, then every output, in port order. */
  labels: string[];
}

/**
 * Reads a circuit's port surface off the INPUT/OUTPUT plugs in its body. Ports
 * are ordered by each plug's `index` option, then by document order — the
 * editor writes clean `0..n-1` indices, so duplicates and gaps arise only in
 * externally authored data and the tiebreaker keeps the order total.
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
 * A plug's position in its group. Absent or non-numeric reads as 0, sorting it
 * to the front with document order breaking the tie, because
 * {@link deriveCircuitSummary} must answer for any parseable document.
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
