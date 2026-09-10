import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ChangelogContentService } from './changelog-content.service';

/**
 * Loads the changelog before the page activates, so the server render carries
 * every release in its first byte and the feed's readers are not the only ones
 * who get the notes without running JavaScript.
 */
export const changelogContentGuard: CanActivateFn = async () => {
  await inject(ChangelogContentService).resolve();
  return true;
};
