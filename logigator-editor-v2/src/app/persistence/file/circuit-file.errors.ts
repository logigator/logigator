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
