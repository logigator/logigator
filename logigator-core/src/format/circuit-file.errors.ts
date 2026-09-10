/**
 * A document could not be parsed: malformed JSON, a structurally invalid
 * element, or an envelope matching no known format.
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
 * definition whose declared ports disagree with its circuit. The shape is fine;
 * what it names does not exist or is out of range. Only `strict` throws it.
 */
export class CircuitIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitIntegrityError';
  }
}

/**
 * The document declares a format version newer than this build supports. There
 * is no forward migration, so it cannot be read.
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
