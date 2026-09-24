import { describe, expect, it } from 'vitest';
import { gunzipBytes, gunzipJson, gzipBytes, gzipJson } from './gzip.codec';

describe('gzip codec', () => {
  it('round-trips a JSON string unchanged', async () => {
    const json = JSON.stringify({
      version: 1,
      name: 'demo',
      components: [{ t: 0, p: [1, 2] }]
    });

    expect(await gunzipJson(await gzipJson(json))).toBe(json);
  });

  it('round-trips non-ASCII text through UTF-8', async () => {
    // The byte count and the character count differ here, which is the whole
    // reason the codec encodes rather than assuming one byte per char.
    const json = JSON.stringify({ name: 'Zähler — 计数器 🧮' });

    expect(await gunzipJson(await gzipJson(json))).toBe(json);
  });

  it('writes a gzip member the container flag claims it is', async () => {
    const bytes = await gzipJson('{}');

    // 1f 8b 08: gzip magic plus the deflate method. What goes out under
    // `Content-Encoding: gzip` has to be gzip and not a bare deflate stream.
    expect(bytes[0]).toBe(0x1f);
    expect(bytes[1]).toBe(0x8b);
    expect(bytes[2]).toBe(0x08);
  });

  it('compresses a repetitive document well below its raw size', async () => {
    const raw = JSON.stringify({
      components: Array.from({ length: 2000 }, (_, i) => ({ t: 0, p: [i, 0] }))
    });

    const bytes = await gzipJson(raw);
    expect(bytes.length).toBeLessThan(raw.length / 4);
  });

  it('rejects bytes that are not a gzip stream', async () => {
    await expect(
      gunzipJson(new TextEncoder().encode('not gzip at all'))
    ).rejects.toThrow();
  });

  it('rejects a truncated stream through the CRC trailer', async () => {
    const bytes = await gzipJson(JSON.stringify({ name: 'demo' }));

    await expect(
      gunzipBytes(new Uint8Array(bytes.subarray(0, bytes.length - 4)))
    ).rejects.toThrow();
  });

  it('round-trips arbitrary bytes, not just text', async () => {
    const data = new Uint8Array(512);
    for (let i = 0; i < data.length; i++) data[i] = (i * 37) % 256;

    expect(await gunzipBytes(await gzipBytes(data))).toEqual(data);
  });
});
