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
 * The framework's pipe does the validating; this subclass exists for the
 * failure body alone, since the contract's error shape is what clients read. A
 * parameter that declares no schema passes through untouched.
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
 * Groups the issues by field, so a form can put each message next to its input.
 * A cross-field issue belongs to the payload as a whole and is keyed by an
 * empty path.
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
 * spec-legal, and `String(segment)` on the second gives `[object Object]`.
 */
function segmentKey(
  segment: PropertyKey | StandardSchemaV1.PathSegment
): string {
  return String(
    typeof segment === 'object' && segment !== null ? segment.key : segment
  );
}
