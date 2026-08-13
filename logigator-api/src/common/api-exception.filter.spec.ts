import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  Post,
  UnsupportedMediaTypeException
} from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { apiErrorSchema } from '@logigator/contract';
import { ApiException } from './api-exception';
import { AppModule } from '../app.module';
import { loadEnv } from '../config/env';

@Controller('probe')
class ProbeController {
  @Get('conflict')
  conflict(): never {
    throw new ConflictException('Already exists.');
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException();
  }

  @Get('media-type')
  mediaType(): never {
    throw new UnsupportedMediaTypeException();
  }

  @Get('coded')
  coded(): never {
    throw new ApiException(HttpStatus.CONFLICT, 'conflict', 'Name is taken.', {
      name: ['already in use']
    });
  }

  @Get('boom')
  boom(): never {
    throw new TypeError('a defect with a leaky message');
  }

  @Post('echo')
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

describe('ApiExceptionFilter', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forEnv(loadEnv({ LOG_LEVEL: 'silent' }))],
      controllers: [ProbeController]
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      // Small enough that a modest payload trips the body limit.
      new FastifyAdapter({ bodyLimit: 128, logger: false }),
      // The defect cases log a stack by design; silence it so a passing run
      // does not read like a failing one.
      { logger: false }
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Every one of these reaches the filter, including the failures Fastify
  // raises before a handler runs — those arrive as an HttpException whose
  // payload is a bare string rather than an object.
  it.each([
    ['an unmatched route', { method: 'GET', url: '/nope' }, 404, 'not_found'],
    [
      'a method with no route',
      { method: 'DELETE', url: '/probe/echo' },
      404,
      'not_found'
    ],
    [
      'a thrown Nest exception',
      { method: 'GET', url: '/probe/conflict' },
      409,
      'conflict'
    ],
    [
      'an exception with no message',
      { method: 'GET', url: '/probe/forbidden' },
      403,
      'forbidden'
    ],
    [
      'a status with no code of its own',
      { method: 'GET', url: '/probe/media-type' },
      415,
      'bad_request'
    ],
    [
      'a malformed JSON body',
      {
        method: 'POST',
        url: '/probe/echo',
        payload: '{ not json',
        headers: { 'content-type': 'application/json' }
      },
      400,
      'bad_request'
    ],
    [
      'a body over the limit',
      {
        method: 'POST',
        url: '/probe/echo',
        payload: JSON.stringify({ a: 'x'.repeat(500) }),
        headers: { 'content-type': 'application/json' }
      },
      413,
      'bad_request'
    ],
    [
      'an unhandled defect',
      { method: 'GET', url: '/probe/boom' },
      500,
      'internal'
    ]
  ])('answers %s with the contract body', async (_, request, status, code) => {
    const response = await app.inject(
      request as Parameters<NestFastifyApplication['inject']>[0]
    );

    expect(response.statusCode).toBe(status);
    const body = apiErrorSchema.parse(response.json());
    expect(body.code).toBe(code);
    expect(body.message).not.toHaveLength(0);
  });

  it('keeps the message of an unhandled defect off the wire', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/boom' });

    expect(response.payload).not.toContain('leaky');
  });

  it('prefers the code and details an ApiException names over the status', async () => {
    const response = await app.inject({ method: 'GET', url: '/probe/coded' });

    expect(apiErrorSchema.parse(response.json())).toEqual({
      code: 'conflict',
      message: 'Name is taken.',
      details: { name: ['already in use'] }
    });
  });
});
