import { InvalidFileError } from './circuit-file.errors';
import { CURRENT_FILE_VERSION, CurrentCircuitFile } from './circuit-file.types';

/**
 * Structural validation of a current-version document: the single place that
 * turns untrusted parsed JSON into a {@link CurrentCircuitFile} downstream code
 * can index into without shape checks. Runs after the migration chain, and
 * anything structurally wrong throws {@link InvalidFileError}.
 *
 * A component block's invariant is **lengths**: `x.length` is the block's
 * length and every other column matches it, a negation column's two columns
 * match each other, and its index deltas sum to indices inside the block. Which
 * option keys a block carries is deliberately *not* checked — a built-in that
 * gains an option later leaves stored documents without that column, and they
 * must keep parsing, the catalog step filling the missing key with its default.
 * Writing every option of every component is an invariant of the encoder, not
 * an assumption a reader may make.
 *
 * Deliberate tolerances, matching decode: `components`/`wires`/`definitions`
 * may be absent (decoded as empty), `name` falls back to a default, and option
 * values are not checked here — only the shape of the column holding them.
 */

function fail(path: string, expected: string): never {
  throw new InvalidFileError(`File "${path}" must be ${expected}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'number')
  );
}

/** A column that must line up with the block's `x`. */
function validateColumn(value: unknown, path: string, length: number): void {
  if (!Array.isArray(value)) fail(path, 'an array');
  if (value.length !== length) {
    fail(path, `an array of ${length} values, matching "x"`);
  }
}

/** The same, for a column the decoder does arithmetic on. */
function validateNumberColumn(
  value: unknown,
  path: string,
  length: number
): void {
  if (!isNumberArray(value)) fail(path, 'an array of numbers');
  if (value.length !== length) {
    fail(path, `an array of ${length} numbers, matching "x"`);
  }
}

/**
 * The index deltas walk the block once, so their running sum has to stay inside
 * it: a delta running past the end would otherwise decode as a negation nothing
 * carries.
 */
function validateNegationColumn(
  value: unknown,
  path: string,
  length: number
): void {
  if (!Array.isArray(value) || value.length !== 2) {
    fail(path, 'a pair of columns');
  }
  const [deltas, ports] = value as [unknown, unknown];
  if (!isNumberArray(deltas)) fail(`${path}[0]`, 'an array of numbers');
  if (!Array.isArray(ports)) fail(`${path}[1]`, 'an array');
  if (ports.length !== deltas.length) {
    fail(
      `${path}[1]`,
      `an array of ${deltas.length} values, matching "${path}[0]"`
    );
  }
  ports.forEach((entry, i) => {
    if (!isNumberArray(entry)) fail(`${path}[1][${i}]`, 'an array of numbers');
  });

  let index = -1;
  for (const [i, delta] of deltas.entries()) {
    index += delta;
    if (!Number.isInteger(index) || index < 0 || index >= length) {
      fail(`${path}[0][${i}]`, 'an index delta inside the block');
    }
  }
}

function validateComponentBlock(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, 'an object');
  if (typeof value['type'] !== 'number') fail(`${path}.type`, 'a number');
  if (!isNumberArray(value['x'])) fail(`${path}.x`, 'an array of numbers');
  const length = (value['x'] as number[]).length;

  validateNumberColumn(value['y'], `${path}.y`, length);

  const dir = value['dir'];
  if (dir !== undefined) validateNumberColumn(dir, `${path}.dir`, length);

  const opt = value['opt'];
  if (opt !== undefined) {
    if (!isRecord(opt)) fail(`${path}.opt`, 'an object');
    for (const [key, column] of Object.entries(opt)) {
      validateColumn(column, `${path}.opt.${key}`, length);
    }
  }

  for (const field of ['negIn', 'negOut'] as const) {
    const negation = value[field];
    if (negation === undefined) continue;
    validateNegationColumn(negation, `${path}.${field}`, length);
  }
}

function validateDefinition(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, 'an object');
  if (typeof value['type'] !== 'number') fail(`${path}.type`, 'a number');
  if (typeof value['name'] !== 'string') fail(`${path}.name`, 'a string');
  if (typeof value['symbol'] !== 'string') fail(`${path}.symbol`, 'a string');
  if (typeof value['description'] !== 'string') {
    fail(`${path}.description`, 'a string');
  }
  if (typeof value['numInputs'] !== 'number') {
    fail(`${path}.numInputs`, 'a number');
  }
  if (typeof value['numOutputs'] !== 'number') {
    fail(`${path}.numOutputs`, 'a number');
  }
  const labels = value['labels'];
  if (!Array.isArray(labels) || labels.some((l) => typeof l !== 'string')) {
    fail(`${path}.labels`, 'an array of strings');
  }
  const components = value['components'];
  if (!Array.isArray(components)) fail(`${path}.components`, 'an array');
  components.forEach((c, i) =>
    validateComponentBlock(c, `${path}.components[${i}]`)
  );
  if (typeof value['wires'] !== 'string') fail(`${path}.wires`, 'a string');
  const source = value['source'];
  if (source !== undefined) {
    if (!isRecord(source)) fail(`${path}.source`, 'an object');
    if (typeof source['id'] !== 'string') fail(`${path}.source.id`, 'a string');
    if (typeof source['version'] !== 'number') {
      fail(`${path}.source.version`, 'a number');
    }
  }
}

function validateAttributionEntry(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, 'an object');
  if (typeof value['projectId'] !== 'string') {
    fail(`${path}.projectId`, 'a string');
  }
  if (typeof value['projectName'] !== 'string') {
    fail(`${path}.projectName`, 'a string');
  }
  if (typeof value['authorName'] !== 'string') {
    fail(`${path}.authorName`, 'a string');
  }
}

/**
 * Validates a document already at {@link CURRENT_FILE_VERSION} and returns it
 * typed. Throws {@link InvalidFileError} on any structural mismatch.
 */
export function validateCurrentCircuitFile(data: unknown): CurrentCircuitFile {
  if (!isRecord(data)) {
    throw new InvalidFileError('File is not an object');
  }
  if (data['version'] !== CURRENT_FILE_VERSION) {
    fail('version', `${CURRENT_FILE_VERSION}`);
  }

  const components = data['components'];
  if (components !== undefined) {
    if (!Array.isArray(components)) fail('components', 'an array');
    components.forEach((c, i) => validateComponentBlock(c, `components[${i}]`));
  }

  const wires = data['wires'];
  if (wires !== undefined && typeof wires !== 'string') {
    fail('wires', 'a string');
  }

  const definitions = data['definitions'];
  if (definitions !== undefined) {
    if (!Array.isArray(definitions)) fail('definitions', 'an array');
    definitions.forEach((d, i) => validateDefinition(d, `definitions[${i}]`));
  }

  const attribution = data['attribution'];
  if (attribution !== undefined) {
    if (!Array.isArray(attribution)) fail('attribution', 'an array');
    attribution.forEach((a, i) =>
      validateAttributionEntry(a, `attribution[${i}]`)
    );
  }

  return data as unknown as CurrentCircuitFile;
}
