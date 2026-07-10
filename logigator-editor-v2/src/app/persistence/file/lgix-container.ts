import { InvalidFileError, UnsupportedVersionError } from './circuit-file.errors';

/**
 * The `.lgix` container: a small binary framing around the native circuit-file
 * JSON, adding gzip compression and a magic-byte header.
 *
 * ```
 * offset 0   "LGIX"                4 bytes   magic
 * offset 4   container version     1 byte    (= LGIX_CONTAINER_VERSION)
 * offset 5   flags                 1 byte    bit0..: compression algorithm
 * offset 6   gzip(utf8(json))      …         the CircuitFileService JSON string
 * ```
 *
 * Integrity is corruption-detection only: the magic + version + flags validate
 * the header, and gzip's own CRC32 trailer makes {@link decodeLgix} reject any
 * corrupted or truncated payload (the decompression stream errors). There is no
 * keyed check — a client-only SPA ships its own verification logic, so nothing
 * here resists a determined forger; the share-reimport defense lives in the UI
 * (export is not offered for borrowed `source:'share'` documents).
 *
 * The framing touches only the file export/import boundary. The JSON it wraps —
 * and every other target (browser IndexedDB, server v0) — is unchanged.
 */

/** ASCII `LGIX`. */
const MAGIC = Uint8Array.of(0x4c, 0x47, 0x49, 0x58);
const HEADER_LENGTH = 6;
const VERSION_OFFSET = 4;
const FLAGS_OFFSET = 5;

/**
 * Container-framing version — a **third** version axis, independent of the
 * circuit file-format version (inside the JSON payload) and the custom-component
 * master version. Bump only when the byte framing itself changes.
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
 * Runs a byte buffer through a (de)compression transform by pushing it into the
 * writer and draining the reader concurrently — write/close are intentionally
 * not awaited before {@link collect} starts, so a bounded internal buffer can't
 * deadlock. A decompression failure (gzip CRC mismatch, truncation) rejects the
 * stream, surfacing as a thrown error to the caller.
 */
async function transform(
  data: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter();
  // The failure we care about surfaces through the readable (collect throws);
  // swallow the mirrored writable-side rejection so it isn't left unhandled.
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

/** Frames a circuit-file JSON string into a gzip-compressed `.lgix` container. */
export async function encodeLgix(json: string): Promise<Uint8Array<ArrayBuffer>> {
  const payload = await gzip(new Uint8Array(encoder.encode(json)));
  const out = new Uint8Array(HEADER_LENGTH + payload.length);
  out.set(MAGIC, 0);
  out[VERSION_OFFSET] = LGIX_CONTAINER_VERSION;
  out[FLAGS_OFFSET] = Compression.Gzip;
  out.set(payload, HEADER_LENGTH);
  return out;
}

/**
 * Unwraps a `.lgix` container back into its circuit-file JSON string. Throws
 * {@link InvalidFileError} on a bad header, an unknown compression flag, or a
 * corrupted payload (gzip CRC mismatch), and {@link UnsupportedVersionError}
 * when the container was written by a newer editor.
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
