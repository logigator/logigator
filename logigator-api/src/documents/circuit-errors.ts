import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-exception';

/**
 * A document that is not there, or not the caller's — deliberately the same
 * answer. Telling the two apart would let anyone enumerate which ids exist,
 * which is exactly what a private document should not reveal.
 */
export function circuitNotFound(kind: 'project' | 'component'): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    'not_found',
    `No such ${kind}.`
  );
}

/**
 * The write was against a version that is no longer current: another session or
 * tab saved in between. The server does not merge — the client, which has both
 * the user and the other version's content, decides.
 */
export function versionConflict(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'version_conflict',
    'This has been saved elsewhere since you opened it. Reload to see the current version.'
  );
}
