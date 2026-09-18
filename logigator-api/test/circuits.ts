import {
  assembleCircuitFile,
  BuiltInComponentType,
  type SerializedCircuitBody,
  type SerializedComponentBody,
  type SnapshotDefinition
} from '@logigator/core';

/**
 * Real documents for the specs that write them, through `assembleCircuitFile` —
 * the function the editor's save path calls. Hand-written JSON gets the compact
 * wire chain and the delta-encoded positions subtly wrong.
 */

export const EMPTY_BODY: SerializedCircuitBody = { components: [], wires: [] };

export function circuitDocument(
  name: string,
  body: SerializedCircuitBody = EMPTY_BODY,
  definitions: SnapshotDefinition[] = []
): Record<string, unknown> {
  return { ...assembleCircuitFile(body, definitions, name).file };
}

export function plug(
  type: BuiltInComponentType.INPUT | BuiltInComponentType.OUTPUT,
  index: number,
  label: string
): SerializedComponentBody {
  return {
    type,
    pos: [type === BuiltInComponentType.INPUT ? 0 : 8, index * 2],
    options: { index, label }
  };
}

/**
 * Any placed component: a built-in, or a custom instance whose type id is
 * document-local and therefore above the enum's range.
 */
export function gate(
  type: number,
  x: number,
  y: number
): SerializedComponentBody {
  // Options omitted on purpose: a document without one takes the catalog
  // default in both parse modes, as the editor's load path does.
  return { type, pos: [x, y], options: {} };
}

/** Two inputs, an XOR, one output — small but not empty. */
export const HALF_ADDER_BODY: SerializedCircuitBody = {
  components: [
    plug(BuiltInComponentType.INPUT, 0, 'A'),
    plug(BuiltInComponentType.INPUT, 1, 'B'),
    gate(BuiltInComponentType.XOR, 4, 0),
    plug(BuiltInComponentType.OUTPUT, 0, 'S')
  ],
  wires: [
    { pos: [1, 0], direction: 0, length: 3 },
    { pos: [1, 2], direction: 0, length: 3 }
  ]
};

/**
 * A snapshot of a library component, the way a document embeds one. A `source`
 * of origin `'server'` is what makes it a dependency edge, and the declared
 * port counts must match the plugs in `body` — the parse checks.
 */
export function serverSnapshot(options: {
  type: number;
  masterId: string;
  version: number;
  name?: string;
  body?: SerializedCircuitBody;
}): SnapshotDefinition {
  const body = options.body ?? {
    components: [
      plug(BuiltInComponentType.INPUT, 0, 'in'),
      plug(BuiltInComponentType.OUTPUT, 0, 'out')
    ],
    wires: []
  };
  const inputs = body.components.filter(
    (c) => c.type === BuiltInComponentType.INPUT
  ).length;
  const outputs = body.components.filter(
    (c) => c.type === BuiltInComponentType.OUTPUT
  ).length;

  return {
    type: options.type,
    name: options.name ?? 'Embedded',
    symbol: 'EMB',
    description: '',
    numInputs: inputs,
    numOutputs: outputs,
    labels: Array.from({ length: inputs + outputs }, (_, i) => `p${i}`),
    source: {
      id: options.masterId,
      version: options.version,
      origin: 'server'
    },
    components: body.components,
    wires: body.wires
  };
}
