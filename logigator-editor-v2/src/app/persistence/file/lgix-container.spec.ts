import { describe, expect, it } from 'vitest';
import {
  decodeLgix,
  encodeLgix,
  hasLgixMagic,
  LGIX_CONTAINER_VERSION
} from './lgix-container';
import {
  InvalidFileError,
  UnsupportedVersionError
} from './circuit-file.errors';

const MAGIC = 'LGIX';

describe('lgix-container', () => {
  it('round-trips a JSON string unchanged', async () => {
    const json = JSON.stringify({ version: 1, name: 'demo', components: [] });
    const bytes = await encodeLgix(json);
    expect(await decodeLgix(bytes)).toBe(json);
  });

  it('writes the magic, version and gzip flag in the header', async () => {
    const bytes = await encodeLgix('{}');
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe(MAGIC);
    expect(bytes[4]).toBe(LGIX_CONTAINER_VERSION);
    expect(bytes[5]).toBe(0); // gzip
  });

  it('compresses a repetitive payload well below its raw size', async () => {
    const raw = JSON.stringify({
      components: Array.from({ length: 500 }, (_, i) => ({
        type: 1,
        pos: [i, 0],
        options: { direction: 0 }
      }))
    });
    const bytes = await encodeLgix(raw);
    // Repeated keys/values must gzip to a fraction of the JSON footprint.
    expect(bytes.length).toBeLessThan(raw.length / 4);
  });

  it('detects the magic only on genuine containers', async () => {
    expect(hasLgixMagic(await encodeLgix('{}'))).toBe(true);
    expect(hasLgixMagic(new TextEncoder().encode('{"a":1}'))).toBe(false);
    expect(hasLgixMagic(new Uint8Array(2))).toBe(false);
  });

  it('rejects a buffer without the magic bytes', async () => {
    const plainJson = new TextEncoder().encode('{"version":1}');
    await expect(decodeLgix(plainJson)).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('rejects an unknown compression flag', async () => {
    const bytes = await encodeLgix('{}');
    bytes[5] = 0x7f;
    await expect(decodeLgix(bytes)).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('rejects a corrupted (truncated) payload via the gzip CRC', async () => {
    const bytes = await encodeLgix(
      JSON.stringify({ components: Array.from({ length: 100 }, () => 1) })
    );
    const truncated = bytes.subarray(0, bytes.length - 4);
    await expect(decodeLgix(truncated)).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('rejects a mid-body bit flip (intact trailer, CRC mismatch)', async () => {
    const bytes = await encodeLgix(
      JSON.stringify({ components: Array.from({ length: 100 }, () => 1) })
    );
    // Flip a bit inside the deflate stream, leaving the header and length
    // intact so only gzip's checksum can catch it.
    const mid = Math.floor((6 + bytes.length) / 2);
    bytes[mid] ^= 0xff;
    await expect(decodeLgix(bytes)).rejects.toBeInstanceOf(InvalidFileError);
  });

  it('rejects a container written by a newer editor', async () => {
    const bytes = await encodeLgix('{}');
    bytes[4] = LGIX_CONTAINER_VERSION + 1;
    await expect(decodeLgix(bytes)).rejects.toBeInstanceOf(
      UnsupportedVersionError
    );
  });
});
