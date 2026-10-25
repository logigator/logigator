import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BuiltInComponentType, gzipJson } from '@logigator/core';
import { circuitDocument, gate } from './circuits';
import { CookieJar } from './cookie-jar';
import { startE2eApp, type E2eApp } from './harness';

/**
 * Requests the editor gzips. A browser never compresses a request body of its
 * own — response encoding is negotiated, a request has no such handshake — so
 * the editor applies gzip and declares it, and `@fastify/compress` inflates it
 * in `preParsing`, ahead of the body parser.
 *
 * The bodies here go through core's own `gzipJson`, the codec the editor
 * sends with, so what this asserts the API accepts is the bytes it will get.
 */

/** Fastify's own default, which the API inherited before it set one. */
const OLD_BODY_LIMIT = 1024 * 1024;

/**
 * What this spec runs the API on. Lowered from the 10 MiB default so the
 * refused body is megabytes rather than eleven of them, and high enough that a
 * board past the old default still fits.
 */
const BODY_LIMIT = 4 * 1024 * 1024;

/**
 * A real document — through core's own encoder — grown until it passes a byte
 * mark. Sized by measurement rather than by a component count: how many bytes
 * a component costs is the format's business.
 */
function boardOver(
  name: string,
  bytes: number
): { document: Record<string, unknown>; components: number } {
  for (let components = 1024; ; components *= 2) {
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

/** A JSON body as the editor puts it on the wire. */
async function gzipped(body: unknown): Promise<{
  headers: Record<string, string>;
  payload: Buffer;
}> {
  const bytes = await gzipJson(JSON.stringify(body));
  return {
    headers: {
      'content-type': 'application/json',
      'content-encoding': 'gzip'
    },
    payload: Buffer.from(bytes)
  };
}

describe('gzipped request bodies', () => {
  let api: E2eApp;
  let jar: CookieJar;

  const credentials = { email: 'ada@example.com', password: 'lovelace1' };

  beforeAll(async () => {
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

  it('stores a gzipped document past the old uncompressed ceiling', async () => {
    const { document, components } = boardOver('Big board', OLD_BODY_LIMIT);
    const request = await gzipped({ name: 'Big board', document });

    // The point of the exercise: what travels is a fraction of what arrives.
    expect(request.payload.byteLength).toBeLessThan(OLD_BODY_LIMIT);

    const created = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { ...jar.headers(), ...request.headers },
      payload: request.payload
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().componentCount).toBe(components);

    // And it is the whole document that was stored, not the compressed bytes
    // taken for one: it comes back inflated and complete.
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

  it('saves a gzipped document over an existing project', async () => {
    const created = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: jar.headers(),
      payload: { name: 'Saved compressed' }
    });
    expect(created.statusCode).toBe(201);

    const { document, components } = boardOver(
      'Saved compressed',
      OLD_BODY_LIMIT
    );
    const request = await gzipped({
      document,
      version: created.json().version
    });

    const saved = await api.inject({
      method: 'PUT',
      url: `/api/projects/${created.json().id}`,
      headers: { ...jar.headers(), ...request.headers },
      payload: request.payload
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json().componentCount).toBe(components);
    expect(saved.json().version).toBe(created.json().version + 1);
  });

  it('refuses a body whose inflated size passes the limit', async () => {
    // The zip bomb: a few kilobytes on the wire, megabytes once inflated.
    // Fastify's own parser counts the decompressed bytes against `bodyLimit`,
    // so the limit §3c set is the cap and nothing here has to count.
    const { document } = boardOver('Past the ceiling', BODY_LIMIT);
    const request = await gzipped({ name: 'Zip bomb', document });

    expect(request.payload.byteLength).toBeLessThan(BODY_LIMIT);

    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { ...jar.headers(), ...request.headers },
      payload: request.payload
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().code).toBe('payload_too_large');
  });

  it('still reads an uncompressed body untouched', async () => {
    // No `content-encoding`, so the stream passes through: curl, an older
    // editor build and most of this suite depend on it.
    const { document, components } = boardOver('Plain board', 64 * 1024);

    const created = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: jar.headers(),
      payload: { name: 'Plain board', document }
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().componentCount).toBe(components);
  });

  it('refuses an encoding it was not told to accept', async () => {
    const { headers, payload } = await gzipped({ name: 'Wrong encoding' });

    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { ...jar.headers(), ...headers, 'content-encoding': 'br' },
      payload
    });

    // 415 rather than the body being read as bytes and failing validation:
    // an encoding the API cannot undo is refused before anything parses it.
    expect(response.statusCode).toBe(415);
    expect(response.json().code).toBe('bad_request');

    // And nothing was created by it.
    const listed = await api.inject({
      method: 'GET',
      url: '/api/projects',
      headers: jar.headers()
    });
    expect(
      listed.json().entries.map((entry: { name: string }) => entry.name)
    ).not.toContain('Wrong encoding');
  });

  it('refuses a body that claims gzip and is not', async () => {
    const response = await api.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        ...jar.headers(),
        'content-type': 'application/json',
        'content-encoding': 'gzip'
      },
      payload: Buffer.from('{"name":"Not actually gzipped"}')
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('bad_request');
  });
});
