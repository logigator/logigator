/**
 * The bare gzip codec over a JSON string, on the platform's own
 * `CompressionStream`. Two consumers, one definition: the `.lgix` container
 * frames the bytes it produces (bytes at rest), and a document write sends them
 * under `Content-Encoding: gzip` (bytes in flight).
 *
 * The header and the container are deliberately not unified — six bytes of
 * `LGIX` in front of a stream a proxy was told is gzip is a corrupt body — so
 * what is shared is this codec and nothing above it.
 */

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

/** Compresses raw bytes with gzip. */
export function gzipBytes(
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  return transform(data, new CompressionStream('gzip'));
}

/** Decompresses gzip bytes. Rejects on a corrupted or truncated payload. */
export function gunzipBytes(
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  return transform(data, new DecompressionStream('gzip'));
}

/** Compresses a JSON string to gzipped UTF-8 bytes. */
export function gzipJson(json: string): Promise<Uint8Array<ArrayBuffer>> {
  return gzipBytes(new Uint8Array(encoder.encode(json)));
}

/**
 * The inverse of {@link gzipJson}. Rejects on a payload that does not inflate;
 * the JSON itself is not parsed here.
 */
export async function gunzipJson(bytes: Uint8Array): Promise<string> {
  return decoder.decode(await gunzipBytes(new Uint8Array(bytes)));
}
