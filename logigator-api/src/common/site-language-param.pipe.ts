import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { isAvailableLanguage, type LanguageId } from '@logigator/core';
import { ApiException } from './api-exception';

/**
 * Checks that a path's language segment is one the site is written in. A text
 * in any other language would never be shown, so the path names nothing and
 * answers `404`, as an id that cannot name a row does in `UuidParam`.
 */
export class SiteLanguageParam implements PipeTransform<string, LanguageId> {
  transform(value: string): LanguageId {
    if (!isAvailableLanguage(value)) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'not_found',
        'No such language.'
      );
    }
    return value;
  }
}
