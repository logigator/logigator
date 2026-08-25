import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  assembleCircuitFile,
  builtInMeta,
  CircuitIntegrityError,
  CURRENT_FILE_VERSION,
  deriveCircuitSummary,
  InvalidFileError,
  migrateToCurrent,
  parseCircuitDocument,
  UnsupportedVersionError,
  type CircuitDependencyEdge,
  type CircuitSummary,
  type CurrentCircuitFile
} from '@logigator/core';
import { ApiException } from '../common/api-exception';

/** Everything a write needs to know about the document it was handed. */
export interface IngestedCircuit {
  /** Exactly what goes in the column. */
  document: CurrentCircuitFile;
  formatVersion: number;
  componentCount: number;
  wireCount: number;
  /** The port surface; only a library component stores it. */
  summary: CircuitSummary;
  /** Which library masters the document embeds, at most one edge each. */
  dependencies: CircuitDependencyEdge[];
  /**
   * The fork parent the document *claims*, straight out of its attribution
   * chain and resolved against nothing. The caller checks it against its own
   * rows — that check is the trust anchor of the whole attribution feature.
   */
  claimedParentId: string | null;
}

/**
 * The half of the document path that does not know which table it is writing to.
 *
 * Every write goes through here, and it is the only place a document enters the
 * system: parse, and store what parsing produced. That ordering is the invariant
 * the column depends on — a row this server wrote is a document this server can
 * read, at the newest format version, with every component and option value in
 * the catalog. Anything the pipeline rejects never reaches the database, so a
 * read has nothing to defend against.
 */
@Injectable()
export class CircuitDocumentService {
  private readonly logger = new Logger(CircuitDocumentService.name);

  /**
   * Parses a document a client sent, or produces an empty board when it sent
   * none.
   *
   * `strict` always: an option value out of range or a component the catalog
   * does not have is a rejection, never a silent normalization. The editor does
   * not produce one, so such a document is tampered or bugged, and storing a
   * different circuit than the client sent is worse than refusing it. The
   * lenient mode exists for the one-time migration of the legacy database, where
   * junk has to be salvaged rather than dropped.
   */
  ingest(input: object | undefined, name: string): IngestedCircuit {
    if (input === undefined) return this.empty(name);

    const parsed = this.parse(input);
    if (parsed.warnings.length > 0) {
      // Migration notices, and nothing a client can act on: the document was
      // accepted. Worth a line for the day a legacy upload behaves oddly.
      this.logger.debug(
        `Accepted "${name}" with notices: ${parsed.warnings.join('; ')}`
      );
    }

    return {
      document: toStoredDocument(parsed.file, name),
      formatVersion: parsed.file.version,
      componentCount: parsed.stats.components,
      wireCount: parsed.stats.wires,
      summary: deriveCircuitSummary(parsed.body),
      dependencies: parsed.dependencies,
      claimedParentId: claimedParentId(parsed.file)
    };
  }

  /**
   * The read guard: a version check that passes a current row through
   * untouched.
   *
   * It exists for the window a format bump opens — between the deploy and the
   * bulk re-normalization finishing, and after a crashed run of it — so the API
   * can never hand out a version it no longer speaks. It is a safety net rather
   * than the strategy: relying on it alone would let the table drift back to
   * holding several versions at once, which is exactly what normalizing on write
   * buys.
   */
  read(stored: CurrentCircuitFile, id: string): CurrentCircuitFile {
    if (stored.version === CURRENT_FILE_VERSION) return stored;

    this.logger.warn(
      `Migrating ${id} from format version ${stored.version} on read — the bulk re-normalization has not reached it`
    );
    return this.toCurrent(stored, id);
  }

  private empty(name: string): IngestedCircuit {
    const { file } = assembleCircuitFile(
      { components: [], wires: [] },
      [],
      name
    );
    return {
      document: file,
      formatVersion: file.version,
      componentCount: 0,
      wireCount: 0,
      summary: { numInputs: 0, numOutputs: 0, labels: [] },
      dependencies: [],
      claimedParentId: null
    };
  }

  private parse(input: object) {
    try {
      return parseCircuitDocument(input);
    } catch (error) {
      throw asApiException(error);
    }
  }

  private toCurrent(stored: unknown, id: string): CurrentCircuitFile {
    try {
      return migrateToCurrent(stored, {
        catalog: builtInMeta,
        log: {
          info: () => undefined,
          warn: (message) => this.logger.warn(`${id}: ${message}`)
        }
      });
    } catch (error) {
      throw asApiException(error);
    }
  }
}

/**
 * What actually goes in the column, which is not quite what parsing returned.
 *
 * Two envelope fields belong to the server rather than to the writer. The name
 * is set from the row, so the column and the document's copy of it can never
 * disagree and a rename has one place to happen. The attribution chain is
 * dropped: it is display data a client asserted, and the API answers it by
 * walking its own fork keys — keeping a copy beside that walk would be a second
 * answer to the same question, and a stale or forged one at that.
 */
function toStoredDocument(
  file: CurrentCircuitFile,
  name: string
): CurrentCircuitFile {
  const stored: CurrentCircuitFile = { ...file, name };
  delete stored.attribution;
  return stored;
}

/**
 * The immediate parent a document claims, which is the *last* entry: the chain
 * is root-first, so it ends at the thing this document was forked from.
 */
function claimedParentId(file: CurrentCircuitFile): string | null {
  return file.attribution?.at(-1)?.projectId ?? null;
}

/**
 * Failures of the format pipeline, as a client sees them.
 *
 * `unsupported_format_version` is separated out because it is the one rejection
 * that says nothing is wrong with the document: the client is ahead of the
 * server, which mid-rollout is a matter of waiting. Everything else is the
 * document's own fault and reads the same whether it was truncated, tampered
 * with, or written by a bug.
 */
function asApiException(error: unknown): unknown {
  if (error instanceof UnsupportedVersionError) {
    return new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'unsupported_format_version',
      error.message
    );
  }
  if (
    error instanceof InvalidFileError ||
    error instanceof CircuitIntegrityError
  ) {
    return new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'invalid_document',
      error.message
    );
  }
  return error;
}
