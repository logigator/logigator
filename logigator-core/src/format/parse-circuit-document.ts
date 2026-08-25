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
 * The single entry point for ingesting an untrusted circuit document: version
 * detection → migration to the current format → structural validation → codec
 * decode → catalog integrity → dependency extraction. Every write path does the
 * same dance, so it lives here rather than being reassembled per caller.
 *
 * Two policy lines are deliberate:
 *
 * - **Board-level invariants are NOT enforced.** Wire-topology violations exist
 *   in real documents — that is why the editor ships a Repair Wires command.
 *   Integrity here means "parseable and catalog-consistent", nothing more.
 * - **`strict` never normalizes.** An out-of-range or wrong-typed option value
 *   is rejected rather than quietly clamped: the editor does not produce one, so
 *   a document that fails is tampered or bugged, and silently storing a
 *   different circuit than the client sent is worse than refusing it.
 *   `lenient` is for the one-time migration of legacy database rows, where junk
 *   must be salvaged; it repairs what it can and reports every change it made.
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
   * The current-version document, ready to store verbatim. In `strict` this is
   * the migrated input untouched; in `lenient` it is re-assembled from the
   * repaired body and definitions, so what is stored is what was salvaged.
   */
  file: CurrentCircuitFile;
  /** Its body, decoded out of the compact persisted encodings. */
  body: SerializedCircuitBody;
  /** Its embedded custom-component snapshots, likewise decoded. */
  definitions: SnapshotDefinition[];
  dependencies: CircuitDependencyEdge[];
  stats: CircuitStats;
  /** Recoverable problems: migration notices, plus lenient-mode repairs. */
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

  // A version the chain does not know throws UnsupportedVersionError from
  // here — never store what cannot be parsed.
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
    // `lenient` drops and clamps, so the migrated document no longer describes
    // the circuit that was salvaged out of it — re-encode from what the checks
    // produced, or storing `file` would persist exactly the junk they removed
    // and every later `strict` read of that row would throw.
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
 * A snapshot points back at a library master through `source`. Only a
 * `'server'` origin is an edge the API can resolve — a `'browser'` origin names
 * an id in someone's local library, and an absent `source` is a legitimate
 * self-contained snapshot (a custom that was never saved to a library). Neither
 * is an error; they simply contribute no edge.
 *
 * At most one edge per master: a document naming the same master under two
 * type ids would have instances of both rendering from snapshots of one
 * component, which is a document disagreeing with itself. The editor cannot
 * produce it, so `strict` rejects it and `lenient` keeps the first — and it
 * matters beyond tidiness, because an edge table keyed by (dependent,
 * dependency) has exactly one row to give it either way.
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
 * A definition's declared port counts drive how every placed instance of it
 * renders, frozen at snapshot time — so they must match the plugs in the circuit
 * they were derived from, and the label list must cover both groups.
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
 * Checks every component against the catalog: its type must be a known built-in
 * or a custom id this document defines, and its option values must be legal for
 * that type. In `lenient` mode an unusable component is dropped and an illegal
 * value salvaged; in `strict` the first problem throws.
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
      // A custom id resolves ONLY through this document's definitions: ids are
      // document-local, so falling one through would alias an unrelated type.
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

  // An option the document omits takes its default, in both modes: a missing
  // value is parseable, and this is what the editor's own load path does.
  for (const [key, schema] of Object.entries(meta.options)) {
    if (!(key in checked)) checked[key] = schema.default;
  }

  return checked;
}

/**
 * The value `lenient` stores in place of an illegal one. A number outside its
 * range clamps to the nearest bound rather than falling back to the default —
 * legacy rows really do carry values the current editor no longer allows (a ROM
 * addressed wider than v2 permits, say), and the nearest bound keeps the
 * circuit recognisably itself where the default would silently replace it with
 * an unrelated one. Anything else has no meaningful nearest value.
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
 * The structural validator only checks that `wires` is a string and that a
 * component's `pos` is a number pair — the compact encodings are decoded after
 * it, so their failures have to become the same rejection.
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
