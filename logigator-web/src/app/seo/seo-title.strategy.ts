import { inject, Injectable } from '@angular/core';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { pathnameFromUrl } from '../translation/language-url';
import { PageMeta, SeoService } from './seo.service';

/**
 * Applies a route's `seo` data on every completed navigation.
 *
 * `TitleStrategy` rather than a router-event subscription: the router calls it
 * once per successful navigation, on the server render included, which is
 * exactly when the head has to be right — and there is no subscription to tear
 * down.
 */
@Injectable()
export class SeoTitleStrategy extends TitleStrategy {
  private readonly seo = inject(SeoService);

  public override updateTitle(snapshot: RouterStateSnapshot): void {
    let route = snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const page = route.data['seo'] as PageMeta | undefined;
    if (page) {
      this.seo.apply(page, pathnameFromUrl(snapshot.url));
    }
  }
}
