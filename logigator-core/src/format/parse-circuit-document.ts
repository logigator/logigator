import { builtInMeta } from '../catalog/built-in-meta';
import { ComponentMeta } from '../catalog/component-meta';
import { OptionSchema } from '../catalog/option-schema';
import { validateOptionValue } from '../catalog/validate-option-value';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../model/component-type.enum';
import {
  SerializedCircuitBody,
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition
} from '../model/serialized-circuit';
import {
  decodeComponentPositions,
  PositionDeltaDecodeError
} from '../codecs/position-delta.codec';
import {
  decodeWireChain,
  WireChainDecodeError
} from '../codecs/wire-chain.codec';
import { fromPersistedDefinition } from '../codecs/persisted-definition.codec';
import { assembleCircuitFile } from './assemble-circuit-file';
import { migrateToCurrent } from './circuit-file-migrator';
import { CurrentCircuitFile } from './circuit-file.types';
import { CircuitIntegrityError, InvalidFileError } from './circuit-file.errors';

/**
 * Board-level invariants are not enforced: wire-topology violations exist in
 * real documents, and integrity here means parseable and catalog-consistent.
 *
 * `strict` never normalizes — an illegal option value is rejected rather than
 * clamped, since storing a different circuit than the client sent is worse than
 * refusing it. `lenient` salvages junk out of legacy rows and reports every
 * repair.
 */
export type ParseMode = 'strict' | 'lenient';

/** One edge from this document to a library master it embeds a snapshot of. */
export interface CircuitDependencyEdge {
  /** The master's persistent id in the library it lives in. */
  id: string;
  /** The master version the embedded snapshot was frozen at. */
  version: number;
  /** The document-local type id this document's instances reference. */
  model: number;
}

/** Derived counts worth keeping beside the document as queryable columns. */
export interface CircuitStats {
  components: number;
  wires: number;
  definitions: number;
}

export interface ParsedCircuitDocument {
  /**
   * The current-version document, ready to store verbatim. `strict` leaves the
   * migrated input untouched; `lenient` re-assembles it from the repaired body,
   * so what is stored is what was salvaged.
   */
  file: CurrentCircuitFile;
  /** Its body, decoded out of the compact persisted encodings. */
  body: SerializedCircuitBody;
  /** Its embedded custom-component snapshots, likewise decoded. */
  definitions: SnapshotDefinition[];
  dependencies: CircuitDependencyEdge[];
  stats: CircuitStats;
  /** Migration notices plus lenient-mode repairs. */
  warnings: string[];
}

export interface ParseCircuitDocumentOptions {
  /** Defaults to `strict` — the mode every API write runs in. */
  mode?: ParseMode;
}

export function parseCircuitDocument(
  input: unknown,
  options: ParseCircuitDocumentOptions = {}
): ParsedCircuitDocument {
  const mode = options.mode ?? 'strict';
  const warnings: string[] = [];

  // A version the chain does not know throws UnsupportedVersionError.
  const file = migrateToCurrent(input, {
    catalog: builtInMeta,
    log: {
      info: () => undefined,
      warn: (message) => warnings.push(message)
    }
  });

  const definitions = decodeDefinitions(file);
  const knownCustomTypes = new Set(definitions.map((d) => d.type));

  const report = (message: string): void => {
    if (mode === 'strict') throw new CircuitIntegrityError(message);
    warnings.push(message);
  };

  const body: SerializedCircuitBody = {
    components: checkComponents(
      decodeComponents(file.components),
      'components',
      knownCustomTypes,
      report
    ),
    wires: decodeWires(file.wires)
  };

  for (const [index, definition] of definitions.entries()) {
    checkDefinition(definition, `definitions[${index}]`, report);
    definition.components = checkComponents(
      definition.components,
      `definitions[${index}].components`,
      knownCustomTypes,
      report
    );
  }

  return {
    // `lenient` drops and clamps, so `file` still holds the junk the checks
    // removed; re-encode, or a later `strict` read of the row would throw.
    file: mode === 'lenient' ? reassemble(file, body, definitions) : file,
    body,
    definitions,
    dependencies: extractDependencies(definitions, report),
    stats: {
      components: body.components.length,
      wires: body.wires.length,
      definitions: definitions.length
    },
    warnings
  };
}

/** Re-encodes the checked body into a document, carrying the envelope over. */
function reassemble(
  file: CurrentCircuitFile,
  body: SerializedCircuitBody,
  definitions: readonly SnapshotDefinition[]
): CurrentCircuitFile {
  return assembleCircuitFile(body, definitions, file.name, file.attribution)
    .file;
}

/**
 * Only a `'server'` origin is a resolvable edge; a `'browser'` origin or an
 * absent `source` contributes none and is not an error.
 *
 * At most one edge per master: the same master under two type ids is a document
 * disagreeing with itself, and an edge table keyed by (dependent, dependency)
 * has one row to give it. `strict` rejects it, `lenient` keeps the first.
 */
function extractDependencies(
  definitions: readonly SnapshotDefinition[],
  report: (message: string) => void
): CircuitDependencyEdge[] {
  const edges: CircuitDependencyEdge[] = [];
  const seen = new Set<string>();

  for (const definition of definitions) {
    const source = definition.source;
    if (source?.origin !== 'server') continue;

    if (seen.has(source.id)) {
      report(
        `definitions embed two snapshots of library component ${source.id}, under types ` +
          `${edges.find((edge) => edge.id === source.id)?.model} and ${definition.type}`
      );
      continue;
    }
    seen.add(source.id);

    edges.push({
      id: source.id,
      version: source.version,
      model: definition.type
    });
  }
  return edges;
}

/**
 * A definition's declared port counts drive how every placed instance renders,
 * so they must match the plugs in the circuit they came from and the label list
 * must cover both groups.
 */
function checkDefinition(
  definition: SnapshotDefinition,
  path: string,
  report: (message: string) => void
): void {
  const plugs = (type: BuiltInComponentType): number =>
    definition.components.filter((c) => c.type === type).length;

  const inputs = plugs(BuiltInComponentType.INPUT);
  const outputs = plugs(BuiltInComponentType.OUTPUT);
  if (definition.numInputs !== inputs || definition.numOutputs !== outputs) {
    report(
      `${path} declares ${definition.numInputs}/${definition.numOutputs} ports but its circuit has ${inputs}/${outputs} plugs`
    );
  }

  const expectedLabels = definition.numInputs + definition.numOutputs;
  if (definition.labels.length !== expectedLabels) {
    report(
      `${path} has ${definition.labels.length} labels for ${expectedLabels} ports`
    );
  }
}

/**
 * Checks every component against the catalog: a known built-in or a custom id
 * this document defines, with legal option values. `lenient` drops an unusable
 * component and salvages an illegal value; `strict` throws on the first
 * problem.
 */
function checkComponents(
  components: readonly SerializedComponentBody[],
  path: string,
  knownCustomTypes: ReadonlySet<number>,
  report: (message: string) => void
): SerializedComponentBody[] {
  const kept: SerializedComponentBody[] = [];

  for (const [index, component] of components.entries()) {
    const where = `${path}[${index}]`;

    if (component.type >= CUSTOM_TYPE_ID_BASE) {
      // Custom ids are document-local, so an unresolved one must not fall
      // through: it would alias an unrelated type.
      if (!knownCustomTypes.has(component.type)) {
        report(
          `${where} references custom type ${component.type}, which the document does not define`
        );
        continue;
      }
      kept.push(component);
      continue;
    }

    const meta = builtInMeta(component.type);
    if (!meta) {
      report(`${where} has unknown component type ${component.type}`);
      continue;
    }

    kept.push({
      ...component,
      options: checkOptions(component, meta, where, report)
    });
  }

  return kept;
}

function checkOptions(
  component: SerializedComponentBody,
  meta: ComponentMeta,
  where: string,
  report: (message: string) => void
): Record<string, unknown> {
  const checked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(component.options)) {
    const schema: OptionSchema | undefined = meta.options[key];
    if (!schema) {
      report(`${where} has unknown option "${key}"`);
      continue;
    }
    const problem = validateOptionValue(schema, value);
    if (problem) {
      report(`${where} option "${key}": ${problem}`);
      checked[key] = salvage(schema, value);
      continue;
    }
    checked[key] = value;
  }

  // An option the document omits takes its default, in both modes.
  for (const [key, schema] of Object.entries(meta.options)) {
    if (!(key in checked)) checked[key] = schema.default;
  }

  return checked;
}

/**
 * The value `lenient` stores in place of an illegal one. An out-of-range number
 * clamps to the nearest bound, keeping the circuit recognisably itself where
 * the default would not. Anything else has no meaningful nearest value.
 */
function salvage(schema: OptionSchema, value: unknown): unknown {
  if (schema.kind === 'number' && typeof value === 'number') {
    if (Number.isFinite(value)) {
      return Math.min(schema.max, Math.max(schema.min, value));
    }
  }
  return schema.default;
}

function decodeComponents(
  value: SerializedComponentBody[] | undefined
): SerializedComponentBody[] {
  try {
    return decodeComponentPositions(value ?? []);
  } catch (err) {
    throw asFileError(err);
  }
}

function decodeWires(value: string | undefined): SerializedWireBody[] {
  if (value === undefined) return [];
  try {
    return decodeWireChain(value);
  } catch (err) {
    throw asFileError(err);
  }
}

function decodeDefinitions(file: CurrentCircuitFile): SnapshotDefinition[] {
  return (file.definitions ?? []).map((definition) => {
    try {
      return fromPersistedDefinition(definition);
    } catch (err) {
      throw asFileError(err);
    }
  });
}

/**
 * The structural validator only checks that `wires` is a string and `pos` a
 * number pair; the compact encodings decode after it, so their failures have to
 * become the same rejection.
 */
function asFileError(err: unknown): unknown {
  if (
    err instanceof WireChainDecodeError ||
    err instanceof PositionDeltaDecodeError
  ) {
    return new InvalidFileError(err.message);
  }
  return err;
}
