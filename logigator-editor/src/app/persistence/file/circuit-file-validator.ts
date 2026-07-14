import { InvalidFileError } from './circuit-file.errors';
import { CURRENT_FILE_VERSION, CurrentCircuitFile } from './circuit-file.types';

/**
 * Structural validation of a current-version circuit document — the single
 * place that turns untrusted parsed JSON into a {@link CurrentCircuitFile}
 * downstream code can index into without shape checks. Runs after the
 * migration chain, so it sees native documents (files, browser records) and
 * migrated legacy ones alike; everything structurally wrong throws
 * {@link InvalidFileError}.
 *
 * Deliberate tolerances, matching the decode behavior: the `components` /
 * `wires` / `definitions` sections may be absent (decoded as empty), `name` is
 * unchecked (decode falls back to a default), and `negInputs`/`negOutputs`
 * are unchecked (deserialization sanitizes them element-wise). Option *values*
 * are not validated — only that `options` is an object; a wrong-typed value
 * degrades to that option's default behavior, not a crash.
 */

function fail(path: string, expected: string): never {
  throw new InvalidFileError(`File "${path}" must be ${expected}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberPair(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

function validateComponent(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, 'an object');
  if (typeof value['type'] !== 'number') fail(`${path}.type`, 'a number');
  if (!isNumberPair(value['pos'])) fail(`${path}.pos`, 'a number pair');
  if (!isRecord(value['options'])) fail(`${path}.options`, 'an object');
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
    validateComponent(c, `${path}.components[${i}]`)
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
    components.forEach((c, i) => validateComponent(c, `components[${i}]`));
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

  return data as unknown as CurrentCircuitFile;
}
