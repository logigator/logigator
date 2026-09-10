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
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { apiErrorSchema } from '@logigator/contract';
import { ApiException } from './api-exception';
import { ApiExceptionFilter } from './api-exception.filter';

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

  /** Not every thrown value is an object, and the filter is the last stop. */
  @Get('nothing')
  nothing(): never {
    throw null;
  }

  /**
   * What a Fastify plugin throws: a plain error carrying its own status, not an
   * `HttpException`.
   */
  @Get('plugin-refusal')
  pluginRefusal(): never {
    throw Object.assign(new Error('request file too large'), {
      statusCode: 413,
      code: 'FST_REQ_FILE_TOO_LARGE'
    });
  }

  /** The same shape, but blaming the server — still a defect. */
  @Get('plugin-defect')
  pluginDefect(): never {
    throw Object.assign(new Error('the file buffer was not found'), {
      statusCode: 500,
      code: 'FST_FILE_BUFFER_NOT_FOUND'
    });
  }

  @Post('echo')
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

describe('ApiExceptionFilter', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    // Registered here rather than by importing `AppModule`, whose graph reaches
    // a database and a Redis this spec does not need.
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }]
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      // Small enough that a modest payload trips the body limit.
      new FastifyAdapter({ bodyLimit: 128, logger: false }),
      // The defect cases log a stack by design; silence it.
      { logger: false }
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Every one of these reaches the filter, including the failures Fastify
  // raises before a handler runs, whose payload is a bare string, not object.
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
    ],
    // A plugin's own error is not an `HttpException`, so without reading its
    // status a file over the upload limit would answer 500.
    [
      'a plugin error blaming the caller',
      { method: 'GET', url: '/probe/plugin-refusal' },
      413,
      'bad_request'
    ],
    [
      'a plugin error blaming the server',
      { method: 'GET', url: '/probe/plugin-defect' },
      500,
      'internal'
    ],
    [
      'a thrown non-object',
      { method: 'GET', url: '/probe/nothing' },
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

  it('says why a plugin refused, and stays silent about its defects', async () => {
    const refusal = await app.inject({
      method: 'GET',
      url: '/probe/plugin-refusal'
    });
    // Worth passing on: the caller can act on a file being too large.
    expect(refusal.json().message).toBe('request file too large');

    const defect = await app.inject({
      method: 'GET',
      url: '/probe/plugin-defect'
    });
    expect(defect.payload).not.toContain('buffer');
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
