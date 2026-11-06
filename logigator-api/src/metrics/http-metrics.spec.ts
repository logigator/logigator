import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication
} from '@nestjs/platform-fastify';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ApiException } from '../common/api-exception';
import { ApiExceptionFilter } from '../common/api-exception.filter';
import { registerHttpMetrics } from './http-metrics';
import { Metrics } from './metrics';

@Controller('probe/documents')
class ProbeController {
  @Get(':link')
  read(@Param('link') link: string): { link: string } {
    return { link };
  }

  @Get(':link/conflict')
  conflict(): never {
    throw new ApiException(
      HttpStatus.CONFLICT,
      'version_conflict',
      'The document changed.'
    );
  }
}

describe('the HTTP request counter', () => {
  let app: NestFastifyApplication;
  let metrics: Metrics;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: Metrics, useValue: new Metrics() }
      ]
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({ logger: false }),
      { logger: false }
    );
    registerHttpMetrics(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    metrics = app.get(Metrics);

    for (const url of [
      '/probe/documents/aB3dE5gH7jK9mN1p',
      '/probe/documents/zY8xW6vU4tS2rQ0o',
      '/probe/documents/aB3dE5gH7jK9mN1p/conflict',
      '/no/such/route/aB3dE5gH7jK9mN1p'
    ]) {
      await app.inject({ method: 'GET', url });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('labels each request by its route template, status and error code', async () => {
    const counted = (await metrics.httpRequests.get()).values.map(
      ({ labels, value }) => ({ ...labels, value })
    );

    expect(counted).toEqual(
      expect.arrayContaining([
        {
          route: '/probe/documents/:link',
          method: 'GET',
          status: '200',
          code: '',
          value: 2
        },
        {
          route: '/probe/documents/:link/conflict',
          method: 'GET',
          status: '409',
          code: 'version_conflict',
          value: 1
        },
        {
          route: 'unmatched',
          method: 'GET',
          status: '404',
          code: 'not_found',
          value: 1
        }
      ])
    );
    expect(counted).toHaveLength(3);
  });
});
