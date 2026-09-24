import { describe, expect, it } from 'vitest';
import { validateCurrentCircuitFile } from './circuit-file-validator';
import { InvalidFileError } from './circuit-file.errors';
import { BuiltInComponentType } from '../model/component-type.enum';

/**
 * A three-component AND block plus a one-component definition. The block is the
 * shape the encoder writes: delta columns for the positions, a `dir` column
 * because one instance is rotated, a total option column, and a negation column
 * naming the last component by the gap from the previous negated one.
 */
function validDocument(): Record<string, unknown> {
  return {
    version: 2,
    name: 'x',
    components: [
      {
        type: BuiltInComponentType.AND,
        x: [2, 4, -1],
        y: [3, 0, 6],
        dir: [0, 0, 1],
        opt: { numInputs: [2, 2, 3] },
        negIn: [[3], [[0]]]
      }
    ],
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
        components: [{ type: BuiltInComponentType.NOT, x: [0], y: [0] }],
        wires: '0,0:e2',
        source: { id: 'abc', version: 3, origin: 'browser' }
      }
    ]
  };
}

/** The document's one component block. */
function block(doc: Record<string, unknown>): Record<string, unknown> {
  return (doc['components'] as Record<string, unknown>[])[0];
}

describe('validateCurrentCircuitFile', () => {
  it('returns a structurally valid document unchanged', () => {
    const doc = validDocument();
    expect(validateCurrentCircuitFile(doc)).toBe(doc);
  });

  it('tolerates absent sections and an absent source (decoded as empty/defaults)', () => {
    expect(() => validateCurrentCircuitFile({ version: 2 })).not.toThrow();
    const doc = validDocument();
    delete (doc['definitions'] as Record<string, unknown>[])[0]['source'];
    expect(() => validateCurrentCircuitFile(doc)).not.toThrow();
  });

  it('rejects a document at the wrong version', () => {
    expect(() =>
      validateCurrentCircuitFile({ ...validDocument(), version: 1 })
    ).toThrowError(InvalidFileError);
  });

  /**
   * The forward-compatibility rule, and the reason the column set is not
   * checked: a built-in that gains an option leaves every stored document
   * without that column, and the catalog step fills it with the schema default
   * on read. Writing every option is the encoder's invariant, not the reader's
   * assumption.
   */
  it('accepts a block missing an option column the schema declares', () => {
    const doc = validDocument();
    delete block(doc)['opt'];
    expect(() => validateCurrentCircuitFile(doc)).not.toThrow();
  });

  it('accepts a block carrying an option column the schema does not declare', () => {
    const doc = validDocument();
    (block(doc)['opt'] as Record<string, unknown>)['fromTheFuture'] = [1, 2, 3];
    expect(() => validateCurrentCircuitFile(doc)).not.toThrow();
  });

  it.each([
    [
      'components not an array',
      (d: Record<string, unknown>) => (d['components'] = 'junk')
    ],
    ['a block that is not an object', (d) => (d['components'] = ['junk'])],
    ['a block type that is not a number', (d) => (block(d)['type'] = '1')],
    ['a block x that is not numbers', (d) => (block(d)['x'] = ['0'])],
    // Lengths are the whole structural invariant: a short column would decode
    // as an undefined value against a position that exists.
    ['a y column shorter than x', (d) => (block(d)['y'] = [3, 0])],
    ['a dir column shorter than x', (d) => (block(d)['dir'] = [0])],
    [
      'an option column shorter than x',
      (d) => (block(d)['opt'] = { numInputs: [2, 2] })
    ],
    ['an opt that is not an object', (d) => (block(d)['opt'] = [[2, 2, 3]])],
    [
      'a negation column that is not a pair',
      (d) => (block(d)['negIn'] = [[3]])
    ],
    [
      'negation columns of different lengths',
      (d) => (block(d)['negIn'] = [[1, 1], [[0]]])
    ],
    [
      'negation ports that are not numbers',
      (d) => (block(d)['negIn'] = [[3], ['0']])
    ],
    // The deltas walk the block once; one running past the end names a
    // component the block does not have.
    [
      'a negation index delta past the end of the block',
      (d) => (block(d)['negIn'] = [[4], [[0]]])
    ],
    [
      'a negation index delta before the start of the block',
      (d) => (block(d)['negIn'] = [[0], [[0]]])
    ],
    ['wires not a string', (d) => (d['wires'] = 7)],
    ['definitions not an array', (d) => (d['definitions'] = {})]
  ] as [string, (d: Record<string, unknown>) => void][])(
    'rejects %s with InvalidFileError',
    (_desc, mutate) => {
      const doc = validDocument();
      mutate(doc);
      expect(() => validateCurrentCircuitFile(doc)).toThrowError(
        InvalidFileError
      );
    }
  );

  // The definition body feeds straight into the decoders, so a broken shape has
  // to fail as InvalidFileError here rather than as a later TypeError.
  it.each([
    [
      'definition components not an array',
      (def: Record<string, unknown>) => (def['components'] = 'junk')
    ],
    [
      'definition block without an x column',
      (def: Record<string, unknown>) => (def['components'] = [{ type: 1 }])
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
