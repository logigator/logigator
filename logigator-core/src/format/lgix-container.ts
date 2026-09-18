import {
  InvalidFileError,
  UnsupportedVersionError
} from './circuit-file.errors';

/**
 * The `.lgix` container: gzip compression and a magic-byte header around the
 * native circuit-document JSON.
 *
 * ```
 * offset 0   "LGIX"                4 bytes   magic
 * offset 4   container version     1 byte    (= LGIX_CONTAINER_VERSION)
 * offset 5   flags                 1 byte    bit0..: compression algorithm
 * offset 6   gzip(utf8(json))      …         the document JSON string
 * ```
 *
 * Integrity is corruption detection only: the header validates magic, version
 * and flags, and gzip's CRC32 trailer makes {@link decodeLgix} reject a
 * corrupted or truncated payload. There is no keyed check — a client-only SPA
 * ships its own verification logic, so nothing here resists a forger.
 */

/** ASCII `LGIX`. */
const MAGIC = Uint8Array.of(0x4c, 0x47, 0x49, 0x58);
const HEADER_LENGTH = 6;
const VERSION_OFFSET = 4;
const FLAGS_OFFSET = 5;

/**
 * Container-framing version: a third axis, independent of the document's format
 * version and of a custom-component master version. Bump only when the byte
 * framing changes.
 */
export const LGIX_CONTAINER_VERSION = 1;

/** Compression algorithm, held in the low bits of the flags byte. */
const enum Compression {
  Gzip = 0
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function collect(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Runs a byte buffer through a (de)compression transform. Write and close are
 * deliberately not awaited before {@link collect} starts, so a bounded internal
 * buffer cannot deadlock. A decompression failure rejects the stream.
 */
async function transform(
  data: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter();
  // The failure surfaces through the readable; swallow the mirrored
  // writable-side rejection so it is not left unhandled.
  const ignore = () => undefined;
  void writer.write(data).catch(ignore);
  void writer.close().catch(ignore);
  return collect(stream.readable);
}

function gzip(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return transform(data, new CompressionStream('gzip'));
}

function gunzip(
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  return transform(data, new DecompressionStream('gzip'));
}

/** Whether a buffer starts with the `.lgix` magic bytes. */
export function hasLgixMagic(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIC.length) return false;
  return MAGIC.every((b, i) => bytes[i] === b);
}

/** Frames a document JSON string into a gzip-compressed `.lgix` container. */
export async function encodeLgix(
  json: string
): Promise<Uint8Array<ArrayBuffer>> {
  const payload = await gzip(new Uint8Array(encoder.encode(json)));
  const out = new Uint8Array(HEADER_LENGTH + payload.length);
  out.set(MAGIC, 0);
  out[VERSION_OFFSET] = LGIX_CONTAINER_VERSION;
  out[FLAGS_OFFSET] = Compression.Gzip;
  out.set(payload, HEADER_LENGTH);
  return out;
}

/**
 * Unwraps a `.lgix` container back into its JSON string. Throws
 * {@link InvalidFileError} on a bad header, an unknown compression flag or a
 * corrupted payload, and {@link UnsupportedVersionError} for a newer container.
 */
export async function decodeLgix(bytes: Uint8Array): Promise<string> {
  if (bytes.length < HEADER_LENGTH || !hasLgixMagic(bytes)) {
    throw new InvalidFileError('Not an .lgix file');
  }
  const version = bytes[VERSION_OFFSET];
  if (version > LGIX_CONTAINER_VERSION) {
    throw new UnsupportedVersionError(version, LGIX_CONTAINER_VERSION);
  }
  if (version < LGIX_CONTAINER_VERSION) {
    throw new InvalidFileError(`Unknown .lgix container version: ${version}`);
  }
  if (bytes[FLAGS_OFFSET] !== Compression.Gzip) {
    throw new InvalidFileError(
      `Unknown .lgix compression flag: ${bytes[FLAGS_OFFSET]}`
    );
  }
  let json: Uint8Array;
  try {
    json = await gunzip(new Uint8Array(bytes.subarray(HEADER_LENGTH)));
  } catch {
    throw new InvalidFileError('Corrupted .lgix payload');
  }
  return decoder.decode(json);
}
