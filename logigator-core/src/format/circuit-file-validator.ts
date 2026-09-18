import { InvalidFileError } from './circuit-file.errors';
import { CURRENT_FILE_VERSION, CurrentCircuitFile } from './circuit-file.types';

/**
 * Structural validation of a current-version document: the single place that
 * turns untrusted parsed JSON into a {@link CurrentCircuitFile} downstream code
 * can index into without shape checks. Runs after the migration chain, and
 * anything structurally wrong throws {@link InvalidFileError}.
 *
 * Deliberate tolerances, matching decode: `components`/`wires`/`definitions`
 * may be absent (decoded as empty), `name` falls back to a default, and
 * `negInputs`/`negOutputs` are sanitized element-wise later. Option values are
 * not checked here — only that `options` is an object.
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

  const attribution = data['attribution'];
  if (attribution !== undefined) {
    if (!Array.isArray(attribution)) fail('attribution', 'an array');
    attribution.forEach((a, i) =>
      validateAttributionEntry(a, `attribution[${i}]`)
    );
  }

  return data as unknown as CurrentCircuitFile;
}
