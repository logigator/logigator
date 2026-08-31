import { beforeEach, describe, expect, it } from 'vitest';
import {
  assembleCircuitFile,
  BuiltInComponentType,
  CURRENT_FILE_VERSION,
  type SerializedCircuitBody,
  type SnapshotDefinition
} from '@logigator/core';
import { ApiException } from '../common/api-exception';
import { CircuitDocumentService } from './circuit-document.service';

const EMPTY: SerializedCircuitBody = { components: [], wires: [] };

function document(
  name: string,
  body: SerializedCircuitBody = EMPTY,
  definitions: SnapshotDefinition[] = []
): Record<string, unknown> {
  return { ...assembleCircuitFile(body, definitions, name).file };
}

function plug(
  type: BuiltInComponentType,
  index: number,
  label: string
): SerializedCircuitBody['components'][number] {
  return { type, pos: [0, index], options: { index, label } };
}

describe('CircuitDocumentService', () => {
  let documents: CircuitDocumentService;

  beforeEach(() => {
    documents = new CircuitDocumentService();
  });

  describe('what reaches the column', () => {
    it('takes the name from the row, not from the document', () => {
      const ingested = documents.ingest(
        document('what the client called it'),
        'what the row calls it'
      );
      expect(ingested.document.name).toBe('what the row calls it');
    });

    it('drops the attribution chain a client asserted', () => {
      const claimed = {
        ...document('forked'),
        attribution: [
          { projectId: 'a', projectName: 'Original', authorName: 'ada' }
        ]
      };

      const ingested = documents.ingest(claimed, 'forked');
      expect(ingested.document.attribution).toBeUndefined();
      // Kept as a claim to resolve against real rows, never as stored data.
      expect(ingested.claimedParentId).toBe('a');
    });

    it('reads the immediate parent as the last entry, the chain being root-first', () => {
      const claimed = {
        ...document('forked'),
        attribution: [
          { projectId: 'root', projectName: 'R', authorName: 'ada' },
          { projectId: 'parent', projectName: 'P', authorName: 'grace' }
        ]
      };
      expect(documents.ingest(claimed, 'forked').claimedParentId).toBe(
        'parent'
      );
    });

    it('makes an empty current-version board when no document was sent', () => {
      const ingested = documents.ingest(undefined, 'new project');

      expect(ingested.document.version).toBe(CURRENT_FILE_VERSION);
      expect(ingested.document.name).toBe('new project');
      expect(ingested.componentCount).toBe(0);
      expect(ingested.wireCount).toBe(0);
      expect(ingested.summary).toEqual({
        numInputs: 0,
        numOutputs: 0,
        labels: []
      });
    });
  });

  describe('what it derives', () => {
    it('counts the board rather than trusting anything about it', () => {
      const ingested = documents.ingest(
        document('counted', {
          components: [
            { type: BuiltInComponentType.AND, pos: [0, 0], options: {} },
            { type: BuiltInComponentType.OR, pos: [4, 0], options: {} }
          ],
          wires: [{ pos: [1, 1], direction: 0, length: 3 }]
        }),
        'counted'
      );

      expect(ingested.componentCount).toBe(2);
      expect(ingested.wireCount).toBe(1);
    });

    it('reads the port surface off the plugs', () => {
      const ingested = documents.ingest(
        document('half adder', {
          components: [
            plug(BuiltInComponentType.INPUT, 0, 'A'),
            plug(BuiltInComponentType.INPUT, 1, 'B'),
            plug(BuiltInComponentType.OUTPUT, 0, 'S'),
            plug(BuiltInComponentType.OUTPUT, 1, 'C')
          ],
          wires: []
        }),
        'half adder'
      );

      expect(ingested.summary).toEqual({
        numInputs: 2,
        numOutputs: 2,
        labels: ['A', 'B', 'S', 'C']
      });
    });
  });

  describe('what it refuses', () => {
    it('rejects a version it does not know, as its own kind of failure', () => {
      // Nothing is wrong with the document; the client is ahead of the server.
      const ahead = { ...document('from the future'), version: 99 };

      expect(() => documents.ingest(ahead, 'x')).toThrow(
        expect.objectContaining({ code: 'unsupported_format_version' })
      );
    });

    it('rejects an out-of-range option value rather than clamping it', () => {
      const tampered = document('bad rom', {
        components: [
          {
            type: BuiltInComponentType.ROM,
            pos: [0, 0],
            options: { wordSize: 4, addressSize: 9001, data: '' }
          }
        ],
        wires: []
      });

      expect(() => documents.ingest(tampered, 'x')).toThrow(
        expect.objectContaining({ code: 'invalid_document' })
      );
    });

    it('rejects a component type the catalog does not have', () => {
      const tampered = document('bogus', {
        components: [{ type: 987, pos: [0, 0], options: {} }],
        wires: []
      });

      expect(() => documents.ingest(tampered, 'x')).toThrow(
        expect.objectContaining({ code: 'invalid_document' })
      );
    });

    it('rejects wires the chain codec cannot decode', () => {
      // The structural validator only checks that `wires` is a string, so the
      // codec's own failure must become the same rejection.
      const broken = { ...document('broken'), wires: 'not a wire chain' };

      expect(() => documents.ingest(broken, 'x')).toThrow(
        expect.objectContaining({ code: 'invalid_document' })
      );
    });

    it('answers 422 for every document rejection', () => {
      const rejected = [
        { ...document('a'), version: 99 },
        { ...document('b'), wires: 'nonsense' }
      ];

      for (const input of rejected) {
        expect(() => documents.ingest(input, 'x')).toThrow(
          expect.objectContaining({ status: 422 })
        );
      }
    });

    it('keeps the rejection an ApiException, so nothing reads as a server fault', () => {
      let thrown: unknown;
      try {
        documents.ingest({ ...document('a'), version: 99 }, 'x');
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ApiException);
    });
  });

  describe('the read guard', () => {
    it('passes a current document through untouched', () => {
      const stored = assembleCircuitFile(EMPTY, [], 'stored').file;
      expect(documents.read(stored, 'id')).toBe(stored);
    });
  });
});
