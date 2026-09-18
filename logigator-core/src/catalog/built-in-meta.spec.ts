import { describe, expect, it } from 'vitest';
import { BUILT_IN_META, builtInMeta } from './built-in-meta';
import { defaultOptionValues } from './option-schema';
import { validateOptionValue } from './validate-option-value';
import { Direction } from '../model/direction';

const DIRECTIONS = [Direction.E, Direction.S, Direction.W, Direction.N];

describe('the built-in meta table', () => {
  it('has one entry per type id', () => {
    const types = BUILT_IN_META.map((meta) => meta.type);
    expect(new Set(types).size).toBe(types.length);
    for (const meta of BUILT_IN_META) {
      expect(builtInMeta(meta.type)).toBe(meta);
    }
  });

  for (const meta of BUILT_IN_META) {
    describe(`type ${meta.type} (${meta.symbol})`, () => {
      const values = defaultOptionValues(meta.options);

      it('accepts its own option defaults', () => {
        for (const [key, schema] of Object.entries(meta.options)) {
          expect(
            validateOptionValue(schema, schema.default),
            `${meta.symbol}.${key}`
          ).toBeNull();
        }
      });

      it('names every legacy v0 slot after an option it declares', () => {
        const slots = meta.legacyV0Slots;
        if (!slots) return;
        for (const key of [slots.i, slots.o, slots.s, ...(slots.n ?? [])]) {
          if (key === undefined) continue;
          expect(Object.keys(meta.options), meta.symbol).toContain(key);
        }
      });

      it('labels exactly as many ports as it declares', () => {
        const { inputs, outputs } = meta.ports(values);
        const labels = meta.labels(values);
        // A type either labels a port group fully or not at all — a partial
        // list would silently shift every label past the gap.
        expect(
          [labels.inputs.length, labels.outputs.length],
          meta.symbol
        ).toEqual([
          labels.inputs.length === 0 ? 0 : inputs,
          labels.outputs.length === 0 ? 0 : outputs
        ]);
      });

      it('keeps a body big enough for its ports, in every direction', () => {
        const { inputs, outputs } = meta.ports(values);
        for (const direction of DIRECTIONS) {
          const body = meta.body(values, direction);
          expect(body.width, `${meta.symbol} dir ${direction}`).toBeGreaterThan(
            0
          );
          // Ports are laid out one per row down each side, so a shorter body
          // would push them past its own edge.
          expect(
            body.height,
            `${meta.symbol} dir ${direction}`
          ).toBeGreaterThanOrEqual(Math.max(inputs, outputs));
        }
      });
    });
  }
});
