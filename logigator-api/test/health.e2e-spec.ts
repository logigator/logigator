import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readinessResponseSchema } from '@logigator/contract';
import { startE2eApp, type E2eApp } from './harness';

describe('readiness', () => {
  let api: E2eApp;

  beforeAll(async () => {
    api = await startE2eApp();
  });

  afterAll(async () => {
    await api.close();
  });

  it('reports both backing services as reachable', async () => {
    // The one endpoint that can only pass against real services.
    const response = await api.inject({
      method: 'GET',
      url: '/api/health/ready'
    });

    expect(response.statusCode).toBe(200);
    expect(readinessResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
      checks: { database: { ok: true }, redis: { ok: true } }
    });
  });

  it('answers an unmatched route with the contract error body', async () => {
    const response = await api.inject({ method: 'GET', url: '/api/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'not_found' });
  });
});
