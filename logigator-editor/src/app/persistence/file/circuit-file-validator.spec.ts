import { describe, expect, it } from 'vitest';
import { validateCurrentCircuitFile } from './circuit-file-validator';
import { InvalidFileError } from './circuit-file.errors';

function validDocument(): Record<string, unknown> {
  return {
    version: 1,
    name: 'x',
    components: [{ type: 1, pos: [2, 3], options: { direction: 0 } }],
    wires: '0,0:e3',
    definitions: [
      {
        type: 1000,
        name: 'Adder',
        symbol: 'AD',
        description: '',
        numInputs: 2,
        numOutputs: 1,
        labels: ['a', 'b', 's'],
        components: [{ type: 1, pos: [0, 0], options: {} }],
        wires: '0,0:e2',
        source: { id: 'abc', version: 3, origin: 'browser' }
      }
    ]
  };
}

describe('validateCurrentCircuitFile', () => {
  it('returns a structurally valid document unchanged', () => {
    const doc = validDocument();
    expect(validateCurrentCircuitFile(doc)).toBe(doc);
  });

  it('tolerates absent sections and an absent source (decoded as empty/defaults)', () => {
    expect(() => validateCurrentCircuitFile({ version: 1 })).not.toThrow();
    const doc = validDocument();
    delete (doc['definitions'] as Record<string, unknown>[])[0]['source'];
    expect(() => validateCurrentCircuitFile(doc)).not.toThrow();
  });

  it('rejects a document at the wrong version', () => {
    expect(() =>
      validateCurrentCircuitFile({ ...validDocument(), version: 0 })
    ).toThrowError(InvalidFileError);
  });

  it.each([
    [
      'components not an array',
      (d: Record<string, unknown>) => (d['components'] = 'junk')
    ],
    [
      'component type not a number',
      (d: Record<string, unknown>) =>
        (d['components'] = [{ type: '1', pos: [0, 0], options: {} }])
    ],
    [
      'component pos not a number pair',
      (d: Record<string, unknown>) =>
        (d['components'] = [{ type: 1, pos: [0], options: {} }])
    ],
    [
      'component options not an object',
      (d: Record<string, unknown>) =>
        (d['components'] = [{ type: 1, pos: [0, 0], options: null }])
    ],
    ['wires not a string', (d: Record<string, unknown>) => (d['wires'] = 7)],
    [
      'definitions not an array',
      (d: Record<string, unknown>) => (d['definitions'] = {})
    ]
  ])('rejects %s with InvalidFileError', (_desc, mutate) => {
    const doc = validDocument();
    mutate(doc);
    expect(() => validateCurrentCircuitFile(doc)).toThrowError(
      InvalidFileError
    );
  });

  // The definition body is fed straight into the delta/chain decoders and the
  // registry, so a broken shape must fail as InvalidFileError here — not
  // surface later as a raw TypeError from an array method on a non-array.
  it.each([
    [
      'definition components not an array',
      (def: Record<string, unknown>) => (def['components'] = 'junk')
    ],
    [
      'definition component without options',
      (def: Record<string, unknown>) =>
        (def['components'] = [{ type: 1, pos: [0, 0] }])
    ],
    [
      'definition wires not a string',
      (def: Record<string, unknown>) => (def['wires'] = [])
    ],
    [
      'definition numInputs not a number',
      (def: Record<string, unknown>) => (def['numInputs'] = '2')
    ],
    [
      'definition labels not all strings',
      (def: Record<string, unknown>) => (def['labels'] = ['a', 1])
    ],
    [
      'definition source without an id string',
      (def: Record<string, unknown>) => (def['source'] = { version: 3 })
    ]
  ])('rejects a %s with InvalidFileError', (_desc, mutate) => {
    const doc = validDocument();
    mutate((doc['definitions'] as Record<string, unknown>[])[0]);
    let thrown: unknown;
    try {
      validateCurrentCircuitFile(doc);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(InvalidFileError);
  });
});
