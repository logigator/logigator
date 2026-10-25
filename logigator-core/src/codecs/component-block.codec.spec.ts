import { describe, expect, it } from 'vitest';
import {
  ComponentBlockDecodeError,
  decodeComponentBlocks,
  encodeComponentBlocks
} from './component-block.codec';
import { BuiltInComponentType } from '../model/component-type.enum';
import { Direction } from '../model/direction';
import { SerializedComponentBody } from '../model/serialized-circuit';

const and = (
  x: number,
  y: number,
  extra: Partial<SerializedComponentBody> = {}
): SerializedComponentBody => ({
  type: BuiltInComponentType.AND,
  pos: [x, y],
  options: { numInputs: 2 },
  ...extra
});

const led = (x: number, y: number): SerializedComponentBody => ({
  type: BuiltInComponentType.LED,
  pos: [x, y],
  options: {}
});

describe('component-block.codec', () => {
  describe('encodeComponentBlocks', () => {
    it('emits one block per type, with the block delta starting from zero', () => {
      const { blocks } = encodeComponentBlocks([
        led(34, -15),
        and(-24, -3),
        led(0, 4),
        and(-8, 6)
      ]);

      // Each block's first value is absolute and the rest are gaps from the
      // entry before, so a block reads without the ones before it.
      expect(blocks).toEqual([
        {
          type: BuiltInComponentType.AND,
          x: [-24, 16],
          y: [-3, 9],
          opt: { numInputs: [2, 2] }
        },
        { type: BuiltInComponentType.LED, x: [34, -34], y: [-15, 19] }
      ]);
    });

    it('orders a block by direction, then y, then x', () => {
      const { blocks } = encodeComponentBlocks([
        and(0, 5, { direction: Direction.S }),
        and(7, 1),
        and(2, 1),
        and(3, 0, { direction: Direction.W })
      ]);

      const [block] = blocks;
      expect(block.dir).toEqual([
        Direction.E,
        Direction.E,
        Direction.S,
        Direction.W
      ]);
      // (2,1) before (7,1) inside the East run; the rotated ones follow whatever
      // their coordinates are.
      expect(block.x).toEqual([2, 5, -7, 3]);
      expect(block.y).toEqual([1, 0, 4, -5]);
    });

    it('omits dir for an all-East block and writes it when anything is rotated', () => {
      expect(encodeComponentBlocks([and(0, 0), and(1, 0)]).blocks[0].dir).toBe(
        undefined
      );
      expect(
        encodeComponentBlocks([
          and(0, 0),
          and(1, 0, { direction: Direction.N })
        ]).blocks[0].dir
      ).toEqual([Direction.E, Direction.N]);
    });

    it('writes every option the schema declares, defaulting what a component omitted', () => {
      const { blocks } = encodeComponentBlocks([
        {
          type: BuiltInComponentType.ROM,
          pos: [0, 0],
          options: { wordSize: 8, addressSize: 6, data: 'QQ==' }
        },
        { type: BuiltInComponentType.ROM, pos: [0, 1], options: {} }
      ]);

      expect(blocks[0].opt).toEqual({
        wordSize: [8, 4],
        addressSize: [6, 4],
        data: ['QQ==', '']
      });
    });

    it('drops an option key the catalog does not declare', () => {
      const { blocks } = encodeComponentBlocks([
        and(0, 0, { options: { numInputs: 3, nonsense: 1 } })
      ]);
      expect(blocks[0].opt).toEqual({ numInputs: [3] });
    });

    it('emits no opt for a type with no meta, and none for a type with no options', () => {
      const custom: SerializedComponentBody = {
        type: 1000,
        pos: [0, 0],
        options: {}
      };
      expect(encodeComponentBlocks([custom]).blocks[0].opt).toBe(undefined);
      expect(encodeComponentBlocks([led(0, 0)]).blocks[0].opt).toBe(undefined);
    });

    it('writes negations as index deltas, the first being the index plus one', () => {
      const { blocks } = encodeComponentBlocks([
        and(0, 0, { negInputs: [0] }),
        and(0, 1),
        and(0, 2, { negInputs: [0, 1], negOutputs: [0] })
      ]);

      // Component 0 and component 2 of a three-component block.
      expect(blocks[0].negIn).toEqual([
        [1, 2],
        [[0], [0, 1]]
      ]);
      expect(blocks[0].negOut).toEqual([[3], [[0]]]);
    });

    it('omits both negation columns when nothing in the block is negated', () => {
      const [block] = encodeComponentBlocks([and(0, 0), and(0, 1)]).blocks;
      expect(block.negIn).toBe(undefined);
      expect(block.negOut).toBe(undefined);
    });

    it('does not mutate its input', () => {
      const components = [and(5, 5), and(1, 1)];
      const snapshot = JSON.stringify(components);
      encodeComponentBlocks(components);
      expect(JSON.stringify(components)).toBe(snapshot);
    });
  });

  describe('round trip', () => {
    const board: SerializedComponentBody[] = [
      and(-13, -4, { negInputs: [1] }),
      led(-13, -4),
      and(-13, -4),
      and(6, 2, { direction: Direction.W, negOutputs: [0] }),
      {
        type: BuiltInComponentType.ROM,
        pos: [-40, 17],
        options: { wordSize: 4, addressSize: 4, data: 'QQ==' }
      },
      { type: 1000, pos: [3, -9], options: {}, direction: Direction.S },
      led(0, 0)
    ];

    // Negative coordinates, two components sharing a position and a third at the
    // same one: the deltas that carry them are what a prefix sum has to undo.
    it('restores every component through the emission order', () => {
      const { blocks, order } = encodeComponentBlocks(board);
      expect(decodeComponentBlocks(blocks)).toEqual(order.map((i) => board[i]));
    });

    it('is stable: re-encoding a decoded document reproduces the same columns', () => {
      // Components sharing a position make the sort's tie-break observable, and
      // a re-save that churned the row would show up here.
      const once = encodeComponentBlocks(board).blocks;
      const twice = encodeComponentBlocks(decodeComponentBlocks(once)).blocks;
      expect(twice).toEqual(once);
    });
  });

  describe('decodeComponentBlocks', () => {
    it('leaves an option the block carries no column for absent', () => {
      // The catalog step fills it; the decoder must not invent a value, or a
      // document written before an option existed would carry undefined.
      const [component] = decodeComponentBlocks([
        { type: BuiltInComponentType.AND, x: [4], y: [5] }
      ]);
      expect(component.options).toEqual({});
      expect(component.pos).toEqual([4, 5]);
    });

    it.each([
      ['x is not an array', { type: 1, x: 3, y: [0] }],
      ['x carries a non-number', { type: 1, x: [0, 'a'], y: [0, 0] }],
      [
        'an index delta runs past the block',
        { type: 1, x: [0], y: [0], negIn: [[2], [[0]]] }
      ]
    ])('rejects a block whose %s', (_desc, block) => {
      expect(() => decodeComponentBlocks([block as never])).toThrowError(
        ComponentBlockDecodeError
      );
    });
  });
});
