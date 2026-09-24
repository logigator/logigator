import { beforeEach, describe, expect, it } from 'vitest';
import { detectVersion, migrateToCurrent } from './circuit-file-migrator';
import { MigrationContext } from './migrations/migration';
import { builtInMeta } from '../catalog/built-in-meta';
import { CURRENT_FILE_VERSION } from './circuit-file-version';
import { CircuitFileV2 } from './circuit-file.types';
import {
  InvalidFileError,
  UnsupportedVersionError
} from './circuit-file.errors';

describe('circuit-file-migrator', () => {
  describe('detectVersion', () => {
    it('treats a missing version as legacy (0)', () => {
      expect(detectVersion({ foo: 1 })).toBe(0);
    });

    it('treats a non-number version as legacy (0)', () => {
      expect(detectVersion({ version: '1' })).toBe(0);
      expect(detectVersion({ version: null })).toBe(0);
      expect(detectVersion({ version: NaN })).toBe(0);
    });

    it('treats a non-integer version as legacy (0)', () => {
      expect(detectVersion({ version: 1.5 })).toBe(0);
    });

    it('returns an integer version verbatim', () => {
      expect(detectVersion({ version: 0 })).toBe(0);
      expect(detectVersion({ version: 1 })).toBe(1);
      expect(detectVersion({ version: 3 })).toBe(3);
    });

    it('throws InvalidFileError for a non-object', () => {
      expect(() => detectVersion(null)).toThrowError(InvalidFileError);
      expect(() => detectVersion('x')).toThrowError(InvalidFileError);
      expect(() => detectVersion(5)).toThrowError(InvalidFileError);
    });
  });

  describe('migrateToCurrent', () => {
    let ctx: MigrationContext;
    let messages: string[];

    beforeEach(() => {
      messages = [];
      ctx = {
        catalog: builtInMeta,
        log: {
          info: (message) => messages.push(message),
          warn: (message) => messages.push(message)
        }
      };
    });

    it('throws UnsupportedVersionError for a newer-than-supported version', () => {
      expect(() =>
        migrateToCurrent({ version: CURRENT_FILE_VERSION + 1 }, ctx)
      ).toThrowError(UnsupportedVersionError);
    });

    it('returns an already-current document unchanged', () => {
      const doc: CircuitFileV2 = {
        version: 2,
        name: 'X',
        components: [],
        wires: '',
        definitions: []
      };
      expect(migrateToCurrent(doc, ctx)).toBe(doc);
    });

    // Every step of the chain runs, in order: the walk never jumps straight to
    // the newest version, so a legacy document passes through v1 on its way.
    it('walks a versionless document through the whole chain', () => {
      const legacy = {
        project: { name: 'Legacy', elements: [{ t: 1, p: [0, 0], i: 1, o: 1 }] }
      };
      const result = migrateToCurrent(legacy, ctx);
      expect(result.version).toBe(CURRENT_FILE_VERSION);
      expect(result.name).toBe('Legacy');
      expect(result.components).toEqual([{ type: 1, x: [0], y: [0] }]);
      expect(result.definitions).toEqual([]);
      expect(messages).toEqual([
        'Migrated circuit 0 -> 1',
        'Migrated circuit 1 -> 2'
      ]);
    });
  });
});
