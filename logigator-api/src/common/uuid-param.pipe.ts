import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { ApiException } from './api-exception';

/**
 * Checks that a path parameter is a uuid before it reaches a query.
 *
 * Not a nicety: every identifier in this API is a `uuid` column, and Postgres
 * rejects a comparison against something that is not one — so without this a
 * mistyped URL is a driver error surfacing as a 500, for a request that is
 * merely asking about something that cannot exist.
 *
 * The answer is 404 rather than a validation failure. A path that cannot name a
 * row names nothing, which is what 404 says, and it keeps "no such document" and
 * "not yours" the single indistinguishable answer they are everywhere else.
 */
export class UuidParam implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'not_found', 'No such id.');
    }
    return value;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
