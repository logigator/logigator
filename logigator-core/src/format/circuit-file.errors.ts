/**
 * A file could not be parsed/decoded: malformed JSON, a structurally invalid
 * element, or an envelope that doesn't match any known format.
 */
export class InvalidFileError extends Error {
  constructor(message = 'InvalidFile') {
    super(message);
    this.name = 'InvalidFileError';
  }
}

/**
 * A document that parses but is not catalog-consistent: an unknown component
 * type, an unresolvable custom reference, an illegal option value, or a
 * definition whose declared ports disagree with its own circuit. Distinct from
 * {@link InvalidFileError} because the document's *shape* is fine — what it
 * names does not exist or is out of range. Only `strict` parsing throws it.
 */
export class CircuitIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitIntegrityError';
  }
}

/**
 * The file declares a format version newer than this build supports. Saving only
 * ever emits the current version, so a higher version means a newer editor wrote
 * it and we cannot safely migrate forward.
 */
export class UnsupportedVersionError extends Error {
  constructor(
    public readonly fileVersion: number,
    public readonly supportedVersion: number
  ) {
    super(
      `UnsupportedVersion: file=${fileVersion} supported<=${supportedVersion}`
    );
    this.name = 'UnsupportedVersionError';
  }
}
