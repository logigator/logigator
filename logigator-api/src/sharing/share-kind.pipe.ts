import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { ApiException } from '../common/api-exception';
import type { ShareKind } from './share.service';

/**
 * Checks that the path's `kind` segment names one of the two tables a document
 * lives in before anything is looked up in it — the same turn-away rule
 * {@link import('../common/uuid-param.pipe').UuidParam} applies to an id, and
 * for the same reason: a URL that names no document answers `404` rather than
 * reaching a query that cannot make sense of a segment.
 *
 * The kind is in the address because the link is no longer a key that
 * identifies its table on its own: the same token column exists in both.
 */
export class ShareKindParam implements PipeTransform<string, ShareKind> {
  transform(value: string): ShareKind {
    if (!isShareKind(value)) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'not_found',
        'No such document kind.'
      );
    }
    return value;
  }
}

/** Both kinds, in the singular the API spells them in. */
export const SHARE_KINDS = ['project', 'component'] as const;

function isShareKind(value: string): value is ShareKind {
  return (SHARE_KINDS as readonly string[]).includes(value);
}
