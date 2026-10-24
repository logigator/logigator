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
   * The fork parent the document *claims*, resolved against nothing. Checking
   * it against real rows is the trust anchor of the attribution feature.
   */
  claimedParentId: string | null;
}

/**
 * The half of the document path that does not know which table it writes to.
 *
 * Every write goes through here, and it is the only way a document enters the
 * system: parse, then store what parsing produced. So a row this server wrote
 * is a document it can read, at the newest format version, with every component
 * and option value in the catalog — and a read has nothing to defend against.
 */
@Injectable()
export class CircuitDocumentService {
  private readonly logger = new Logger(CircuitDocumentService.name);

  /**
   * Parses a document a client sent, or produces an empty board when it sent
   * none.
   *
   * `strict` always: an out-of-range option or an unknown component is a
   * rejection, never a silent normalization — storing a different circuit than
   * the client sent is worse than refusing it. Lenient mode belongs to the
   * one-time legacy-database migration, where junk has to be salvaged.
   */
  ingest(input: object | undefined, name: string): IngestedCircuit {
    if (input === undefined) return this.empty(name);

    const parsed = this.parse(input);
    if (parsed.warnings.length > 0) {
      // Migration notices; the document was accepted, so there is nothing for
      // the client to act on.
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
   * The read guard, for the window a format bump opens between the deploy and
   * the bulk re-normalization finishing: the API never hands out a version it
   * no longer speaks. A safety net, not the strategy — leaning on it would let
   * the table drift back to holding several versions at once.
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
 * Two envelope fields belong to the server, not the writer. The name is set
 * from the row, so a rename has one place to happen. The client-asserted
 * attribution chain is dropped — the API answers that by walking its own fork
 * keys, and a stored copy would be a second, forgeable answer.
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
 * `unsupported_format_version` is separate because nothing is wrong with the
 * document — the client is ahead of the server, which mid-rollout is a matter
 * of waiting. Everything else is the document's own fault, however it got that
 * way.
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
