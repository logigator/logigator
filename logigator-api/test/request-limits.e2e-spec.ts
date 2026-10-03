import { randomFillSync } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { BuiltInComponentType } from '@logigator/core';
import { circuitDocument, gate } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/**
 * How big a request may be, at both ends of the stack. A board is JSON and
 * meets Fastify's `bodyLimit`; an avatar is a multipart file and never does —
 * `@fastify/multipart` streams it past the body parser and bounds it by
 * `UPLOAD_MAX_BYTES` instead — so the two limits are asserted separately.
 */

/** Fastify's own default, which the API inherited by saying nothing. */
const OLD_BODY_LIMIT = 1024 * 1024;

/**
 * What this spec runs the API on. Lowered from the 10 MiB default so the
 * refused body is megabytes rather than eleven of them: what is under test is
 * that the configured number is in force and that passing it answers the
 * contract's code, neither of which cares what the number is.
 */
const BODY_LIMIT = 2 * 1024 * 1024;

/** The upload ceiling before it moved, and the one it moved to. */
const OLD_UPLOAD_LIMIT = 5 * 1024 * 1024;
const UPLOAD_LIMIT = 10 * 1024 * 1024;

/**
 * A real document — through core's own encoder — grown until it passes a byte
 * mark. Sized by measurement rather than by a component count: how many bytes
 * a component costs is the format's business, and a constant picked here would
 * quietly stop meaning anything the next time the encoding changes.
 */
function boardOver(
  name: string,
  bytes: number
): { document: Record<string, unknown>; components: number } {
  for (let components = 8192; ; components *= 2) {
    const document = circuitDocument(name, {
      components: Array.from({ length: components }, (_, index) =>
        gate(
          BuiltInComponentType.AND,
          (index % 256) * 4,
          Math.floor(index / 256) * 4
        )
      ),
      wires: []
    });

    if (JSON.stringify(document).length > bytes) {
      return { document, components };
    }
  }
}

/**
 * A PNG of about `bytes`, stored rather than compressed so the encode is cheap
 * and the file lands near its raw size. What is under test is the byte count,
 * not the picture.
 */
async function largePng(bytes: number): Promise<Buffer> {
  const side = Math.ceil(Math.sqrt(bytes / 3));
  const pixels = Buffer.allocUnsafe(side * side * 3);
  randomFillSync(pixels);

  return sharp(pixels, { raw: { width: side, height: side, channels: 3 } })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

/** A file upload as a browser sends it, encoded by Node's own `Request`. */
async function multipart(
  content: Buffer,
  filename: string,
  type: string
): Promise<{ headers: Record<string, string>; payload: Buffer }> {
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(content)], { type }), filename);
  const request = new Request('http://localhost', {
    method: 'POST',
    body: form
  });

  return {
    headers: { 'content-type': request.headers.get('content-type') as string },
    payload: Buffer.from(await request.arrayBuffer())
  };
}

describe('request size limits', () => {
  let api: E2eApp;
  let jar: CookieJar;

  const credentials = { email: 'ada@example.com', password: 'lovelace1' };

  beforeAll(async () => {
    // `UPLOAD_MAX_BYTES` is deliberately left at its default: what the avatar
    // case asserts is that the default itself moved past 5 MiB.
    api = await startE2eApp({ REQUEST_MAX_BYTES: String(BODY_LIMIT) });

    await api.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'Ada', ...credentials }
    });
    await api.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: api.mail.lastToken() }
    });

    jar = new CookieJar();
    jar.store(
      await api.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: credentials
      })
    );
  });

  afterAll(async () => {
    await api.close();
  });

  it('refuses a body over the limit with a code of its own', async () => {
    const { document } = boardOver('Past the ceiling', BODY_LIMIT);

    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: jar.headers(),
      payload: { name: 'Too large', document }
    });

    expect(response.statusCode).toBe(413);
    // Not `bad_request`: the editor branches on the code, and a board it can
    // do something about must not read as a malformed request.
    expect(response.json().code).toBe('payload_too_large');
  });

  it('refuses it before the route has a say', async () => {
    const { document } = boardOver('Past the ceiling', BODY_LIMIT);

    // No session, and a route that demands one. The body parser runs ahead of
    // every guard and pipe, so this is 413 rather than 401 — which is why the
    // mapping has to be in the filter and cannot be a handler's business.
    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Too large', document }
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().code).toBe('payload_too_large');
  });

  it('stores a document past the limit the API used to have', async () => {
    const { document, components } = boardOver('Big board', OLD_BODY_LIMIT);

    const created = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: jar.headers(),
      payload: { name: 'Big board', document }
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().componentCount).toBe(components);

    // And it comes back whole, rather than having been stored truncated.
    const opened = await api.inject({
      method: 'GET',
      url: `/api/projects/${created.json().id}`,
      headers: jar.headers()
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json().componentCount).toBe(components);
    expect(JSON.stringify(opened.json().document).length).toBeGreaterThan(
      OLD_BODY_LIMIT
    );
  });

  it('accepts an upload between the old ceiling and the new one', async () => {
    const image = await largePng(6 * 1024 * 1024);
    expect(image.byteLength).toBeGreaterThan(OLD_UPLOAD_LIMIT);
    expect(image.byteLength).toBeLessThan(UPLOAD_LIMIT);

    const upload = await multipart(image, 'me.png', 'image/png');
    // Larger than `BODY_LIMIT` too, and accepted anyway: a multipart file is
    // streamed past the body parser, so `UPLOAD_MAX_BYTES` is the only limit
    // it ever meets.
    expect(upload.payload.byteLength).toBeGreaterThan(BODY_LIMIT);

    const response = await api.inject({
      method: 'POST',
      url: '/api/user/avatar',
      headers: { ...jar.headers(), ...upload.headers },
      payload: upload.payload
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().avatar.length).toBeGreaterThan(0);
  });
});
