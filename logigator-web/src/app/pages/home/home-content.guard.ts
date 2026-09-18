import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { HomeContentService } from './home-content.service';

/**
 * Resolves the home page's three listings before it activates, so the server
 * render emits the tiles. Never blocks the route: a failed read resolves to
 * its own error state.
 */
export const homeContentGuard: CanActivateFn = async () => {
  await inject(HomeContentService).resolve();
  return true;
};
