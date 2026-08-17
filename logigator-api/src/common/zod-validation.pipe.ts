import { HttpStatus, type PipeTransform } from '@nestjs/common';
import type { ApiError } from '@logigator/contract';
import { z } from 'zod';
import { ApiException } from './api-exception';

/**
 * Validates a request payload against a contract schema.
 *
 * Deliberately the thinnest possible shim: NestJS 12 gives route decorators a
 * Standard-Schema `schema` option (`@Body({ schema })`), which zod satisfies, so
 * this class exists only until that lands and is then deleted rather than
 * migrated. Nothing else in the codebase depends on it — the schemas are the
 * contract's, and the failure body is the contract's error shape.
 */
export class ZodValidationPipe<
  TSchema extends z.ZodType
> implements PipeTransform<unknown, z.output<TSchema>> {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): z.output<TSchema> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    throw new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'validation_failed',
      'The request payload is invalid.',
      detailsFor(result.error)
    );
  }
}

/**
 * Groups the issues by the field they belong to, which is what a form needs to
 * put each message next to its input. Issues that belong to the payload as a
 * whole (a cross-field rule) are keyed by an empty path.
 */
function detailsFor(error: z.ZodError): ApiError['details'] {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.');
    (details[field] ??= []).push(issue.message);
  }
  return details;
}
