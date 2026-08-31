import { describe, expect, it } from 'vitest';
import { parseCircuitDocument } from './parse-circuit-document';
import {
  CircuitIntegrityError,
  InvalidFileError,
  UnsupportedVersionError
} from './circuit-file.errors';
import { CURRENT_FILE_VERSION } from './circuit-file-version';
import { decodeLgix, encodeLgix } from './lgix-container';
import { BuiltInComponentType } from '../model/component-type.enum';

import romV1 from './fixtures/rom.v1.json';
import tunnelsV1 from './fixtures/tunnels.v1.json';
import nestedCustomV1 from './fixtures/nested-custom.v1.json';
import halfAdderV0 from './fixtures/half-adder.v0.json';

/**
 * The v1 fixtures are real editor exports, so what is parsed here came out of
 * the shipping save path rather than being written to satisfy the parser. The
 * v0 fixture is hand-authored, since the repo carries no committed v0 export.
 */

/** A structurally valid but empty current-version document. */
const EMPTY = {
  version: CURRENT_FILE_VERSION,
  name: 'Empty',
  components: [],
  wires: '',
  definitions: []
};

describe('parseCircuitDocument', () => {
  describe('real exported circuits', () => {
    it('parses a built-ins-only export with no warnings', () => {
      const result = parseCircuitDocument(romV1);

      expect(result.warnings).toEqual([]);
      expect(result.stats).toEqual({
        components: 9,
        wires: 8,
        definitions: 0
      });
      expect(result.dependencies).toEqual([]);
      // Positions come back absolute, out of the delta encoding.
      expect(result.body.components[0].pos).toEqual([10, 1]);
      const rom = result.body.components.find(
        (c) => c.type === BuiltInComponentType.ROM
      );
      expect(rom?.options).toEqual({
        wordSize: 4,
        addressSize: 4,
        data: 'QQ=='
      });
    });

    it('parses an export whose options carry text values', () => {
      const result = parseCircuitDocument(tunnelsV1);
      expect(result.warnings).toEqual([]);
      const labels = result.body.components
        .filter((c) => c.type === BuiltInComponentType.TUNNEL)
        .map((c) => c.options['label']);
      expect(labels.length).toBeGreaterThan(0);
      expect(labels.every((l) => typeof l === 'string')).toBe(true);
    });

    it('parses nested custom components, resolving each against the document', () => {
      const result = parseCircuitDocument(nestedCustomV1);

      expect(result.warnings).toEqual([]);
      expect(result.stats.definitions).toBe(2);
      // The outer definition places the inner one, so custom ids have to
      // resolve inside definitions too.
      const outer = result.definitions.find((d) => d.name === 'Outer')!;
      const inner = result.definitions.find((d) => d.name === 'Inner')!;
      expect(outer.components.some((c) => c.type === inner.type)).toBe(true);
    });

    it('extracts no edges for browser-origin snapshots', () => {
      // Both fixture definitions are browser-origin, so nothing names a server
      // master the API could resolve.
      expect(parseCircuitDocument(nestedCustomV1).dependencies).toEqual([]);
    });
  });

  describe('dependency extraction', () => {
    const withSource = (source: unknown) => ({
      ...EMPTY,
      definitions: [
        {
          type: 1000,
          name: 'D',
          symbol: 'D',
          description: '',
          numInputs: 0,
          numOutputs: 0,
          labels: [],
          components: [],
          wires: '',
          ...(source === undefined ? {} : { source })
        }
      ]
    });

    it('emits one edge per server-origin snapshot, keyed by its document type id', () => {
      const result = parseCircuitDocument(
        withSource({ id: 'uuid-1', version: 7, origin: 'server' })
      );
      expect(result.dependencies).toEqual([
        { id: 'uuid-1', version: 7, model: 1000 }
      ]);
    });

    it('treats a source-less snapshot as self-contained, not as an error', () => {
      const result = parseCircuitDocument(withSource(undefined));
      expect(result.dependencies).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('ignores a browser-origin source', () => {
      const result = parseCircuitDocument(
        withSource({ id: 'local-1', version: 2, origin: 'browser' })
      );
      expect(result.dependencies).toEqual([]);
    });

    describe('two snapshots of one master', () => {
      const twice = {
        ...EMPTY,
        definitions: [1000, 1001].map((type) => ({
          type,
          name: 'D',
          symbol: 'D',
          description: '',
          numInputs: 0,
          numOutputs: 0,
          labels: [],
          components: [],
          wires: '',
          source: { id: 'uuid-1', version: 7, origin: 'server' }
        }))
      };

      it('is rejected in strict mode', () => {
        expect(() => parseCircuitDocument(twice)).toThrow(
          CircuitIntegrityError
        );
      });

      it('keeps the first edge in lenient mode and reports the second', () => {
        const result = parseCircuitDocument(twice, { mode: 'lenient' });
        expect(result.dependencies).toEqual([
          { id: 'uuid-1', version: 7, model: 1000 }
        ]);
        expect(result.warnings).toEqual([
          expect.stringContaining('two snapshots of library component uuid-1')
        ]);
      });
    });
  });

  describe('version handling', () => {
    it('migrates a legacy document and reports what it dropped', () => {
      const result = parseCircuitDocument(halfAdderV0);

      expect(result.file.version).toBe(CURRENT_FILE_VERSION);
      expect(result.file.name).toBe('Half adder');
      expect(result.stats.definitions).toBe(1);
      expect(result.stats.wires).toBe(5);
      const definition = result.definitions[0];
      expect(definition.numInputs).toBe(2);
      expect(definition.numOutputs).toBe(2);
      expect(result.warnings).toEqual([]);
    });

    it('rejects a version newer than the chain knows', () => {
      expect(() =>
        parseCircuitDocument({ ...EMPTY, version: CURRENT_FILE_VERSION + 1 })
      ).toThrowError(UnsupportedVersionError);
    });

    it('parses a document out of its .lgix container', async () => {
      const bytes = await encodeLgix(JSON.stringify(romV1));
      const result = parseCircuitDocument(JSON.parse(await decodeLgix(bytes)));
      expect(result.stats).toEqual(parseCircuitDocument(romV1).stats);
    });
  });

  describe('structural failures', () => {
    it('rejects a malformed wire chain as an invalid file', () => {
      expect(() =>
        parseCircuitDocument({ ...EMPTY, wires: 'not-a-chain' })
      ).toThrowError(InvalidFileError);
    });

    it('rejects a document that is not an object', () => {
      expect(() => parseCircuitDocument('nope')).toThrowError(InvalidFileError);
    });
  });

  describe('catalog integrity', () => {
    const withComponent = (component: unknown) => ({
      ...EMPTY,
      components: [component]
    });

    const cases: { name: string; doc: unknown; warning: string }[] = [
      {
        name: 'an unknown built-in type',
        // Below CUSTOM_TYPE_ID_BASE, so it claims to be a built-in.
        doc: withComponent({ type: 99, pos: [0, 0], options: {} }),
        warning: 'unknown component type 99'
      },
      {
        name: 'a custom reference the document does not define',
        doc: withComponent({ type: 1000, pos: [0, 0], options: {} }),
        warning: 'references custom type 1000'
      },
      {
        name: 'an out-of-range option value',
        doc: withComponent({
          type: BuiltInComponentType.AND,
          pos: [0, 0],
          options: { numInputs: 999 }
        }),
        warning: 'out of range'
      },
      {
        name: 'a wrong-typed option value',
        doc: withComponent({
          type: BuiltInComponentType.AND,
          pos: [0, 0],
          options: { numInputs: 'three' }
        }),
        warning: 'expected a finite number'
      },
      {
        name: 'an option the type does not declare',
        doc: withComponent({
          type: BuiltInComponentType.AND,
          pos: [0, 0],
          options: { numInputs: 2, nonsense: 1 }
        }),
        warning: 'unknown option "nonsense"'
      },
      {
        name: 'a definition whose declared ports contradict its circuit',
        doc: {
          ...EMPTY,
          definitions: [
            {
              type: 1000,
              name: 'D',
              symbol: 'D',
              description: '',
              numInputs: 2,
              numOutputs: 1,
              labels: ['a', 'b', 'c'],
              components: [
                { type: BuiltInComponentType.INPUT, pos: [0, 0], options: {} }
              ],
              wires: ''
            }
          ]
        },
        warning: 'declares 2/1 ports but its circuit has 1/0 plugs'
      }
    ];

    for (const { name, doc, warning } of cases) {
      it(`strict rejects ${name}`, () => {
        expect(() => parseCircuitDocument(doc)).toThrowError(
          CircuitIntegrityError
        );
      });

      it(`lenient records ${name} instead of throwing`, () => {
        const result = parseCircuitDocument(doc, { mode: 'lenient' });
        expect(result.warnings.join('\n')).toContain(warning);
      });
    }

    it('lenient drops an unusable component but keeps the rest', () => {
      const result = parseCircuitDocument(
        {
          ...EMPTY,
          components: [
            { type: 99, pos: [0, 0], options: {} },
            { type: BuiltInComponentType.AND, pos: [0, 0], options: {} }
          ]
        },
        { mode: 'lenient' }
      );
      expect(result.body.components.map((c) => c.type)).toEqual([
        BuiltInComponentType.AND
      ]);
      expect(result.stats.components).toBe(1);
    });

    it('lenient clamps an out-of-range number to the nearest bound', () => {
      // Legacy rows carry ROMs addressed wider than the catalog allows; the
      // default would replace the circuit rather than salvage it.
      const result = parseCircuitDocument(
        {
          ...EMPTY,
          components: [
            {
              type: BuiltInComponentType.ROM,
              pos: [0, 0],
              options: { wordSize: 8, addressSize: 16, data: 'QQ==' }
            },
            {
              type: BuiltInComponentType.AND,
              pos: [0, 0],
              options: { numInputs: 0 }
            }
          ]
        },
        { mode: 'lenient' }
      );
      expect(result.body.components[0].options['addressSize']).toBe(11);
      expect(result.body.components[0].options['wordSize']).toBe(8);
      expect(result.body.components[1].options['numInputs']).toBe(2);
    });

    it('lenient returns a document a later strict read accepts', () => {
      // The migration job stores `file`, so the repairs have to be in it or the
      // row keeps the junk and every strict read throws.
      const result = parseCircuitDocument(
        {
          ...EMPTY,
          components: [
            { type: 99, pos: [0, 0], options: {} },
            {
              type: BuiltInComponentType.ROM,
              pos: [1, 0],
              options: { wordSize: 8, addressSize: 16, data: 'QQ==' }
            }
          ]
        },
        { mode: 'lenient' }
      );

      const reread = parseCircuitDocument(result.file);
      expect(reread.body.components.map((c) => c.type)).toEqual([
        BuiltInComponentType.ROM
      ]);
      expect(reread.body.components[0].options['addressSize']).toBe(11);
    });

    it('lenient falls back to the default when there is no nearest value', () => {
      const result = parseCircuitDocument(
        {
          ...EMPTY,
          components: [
            {
              type: BuiltInComponentType.AND,
              pos: [0, 0],
              options: { numInputs: 'three' }
            }
          ]
        },
        { mode: 'lenient' }
      );
      expect(result.body.components[0].options['numInputs']).toBe(2);
    });

    it('fills an omitted option with its default in either mode', () => {
      const result = parseCircuitDocument(
        withComponent({
          type: BuiltInComponentType.ROM,
          pos: [0, 0],
          options: {}
        })
      );
      expect(result.body.components[0].options).toEqual({
        wordSize: 4,
        addressSize: 4,
        data: ''
      });
      expect(result.warnings).toEqual([]);
    });

    it('does not enforce board-level invariants', () => {
      // Two components on one cell and a wire crossing them: nonsense, but real
      // documents contain worse and the editor has a repair command for it.
      const result = parseCircuitDocument({
        ...EMPTY,
        components: [
          { type: BuiltInComponentType.AND, pos: [0, 0], options: {} },
          { type: BuiltInComponentType.AND, pos: [0, 0], options: {} }
        ],
        wires: '0,0:e5'
      });
      expect(result.stats.components).toBe(2);
      expect(result.warnings).toEqual([]);
    });
  });
});
