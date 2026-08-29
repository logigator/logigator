import {
  HttpStatus,
  Injectable,
  StandardSchemaValidationPipe
} from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { ApiError } from '@logigator/contract';
import { ApiException } from './api-exception';

/**
 * Validates every request payload that declares a schema — `@Body({ schema })`,
 * `@Query({ schema })` — against the contract's own zod schema.
 *
 * The framework's pipe does the validating; this subclass exists for the failure
 * body alone, because the contract's error shape is the one thing a client may
 * rely on and Nest's default is a list of prefixed strings. A parameter that
 * declares no schema passes through untouched, which is what leaves
 * {@link UuidParam} and the custom parameter decorators to their own handling.
 */
@Injectable()
export class ApiValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({
      exceptionFactory: (issues) =>
        new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'validation_failed',
          'The request payload is invalid.',
          detailsFor(issues)
        )
    });
  }
}

/**
 * Groups the issues by the field they belong to, which is what a form needs to
 * put each message next to its input. Issues that belong to the payload as a
 * whole (a cross-field rule) are keyed by an empty path.
 */
function detailsFor(
  issues: readonly StandardSchemaV1.Issue[]
): ApiError['details'] {
  const details: Record<string, string[]> = {};
  for (const issue of issues) {
    const field = (issue.path ?? []).map(segmentKey).join('.');
    (details[field] ??= []).push(issue.message);
  }
  return details;
}

/**
 * A path segment is either the key itself or an object wrapping it. Both are
 * spec-legal, and reading `String(segment)` off the second gives
 * `[object Object]` for the field a client is meant to highlight.
 */
function segmentKey(
  segment: PropertyKey | StandardSchemaV1.PathSegment
): string {
  return String(
    typeof segment === 'object' && segment !== null ? segment.key : segment
  );
}
