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

/**
 * A new link was asked for while the document is public. A published address is
 * not a secret — the page's own URL *is* this link, and a crawler, a bookmark
 * and a chat log all hold it — so rotating it would move a page that is out in
 * the world. Setting the document back to unlisted is what unlocks a new one,
 * and that is a decision the owner makes, not a side effect of a save.
 *
 * `409` rather than a validation failure: the body is well formed and names
 * something the API can do, in a state where it will not.
 */
export function linkPublished(kind: 'project' | 'component'): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    'link_published',
    `This ${kind} is published, so its link cannot be rotated. Set it back to unlisted to issue a new one.`
  );
}
