import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslationLoaderService } from '../app/translation/translation-loader.service';
import { TranslationService } from '../app/translation/translation.service';

/**
 * Navigates the one harness a test may create, and returns the rendered page.
 *
 * Every page whose body is markdown waits the same way: ngx-markdown assigns
 * the parsed `innerHTML` asynchronously, so a render is settled only after the
 * task queue has drained. Three pages need it — the documentation, the legal
 * documents and the changelog — and a wait tuned in one of them and not the
 * others is a test that passes for the wrong reason.
 *
 * The locale table is awaited for the same reason, and it is a race of its own:
 * `languageTableGuard` loads a table only when the language *changes*, so a
 * navigation to the language already active leaves the load Transloco starts at
 * init still in flight — and the first assertion of a file can meet a page
 * rendering through its keys. No document races that way: the first render
 * reads the table out of the transfer state, and every later language arrives
 * through the guard.
 *
 * Returning a navigate function rather than a page: two navigations is how a
 * language switch reaches these pages, and a harness may be created once.
 */
export async function markdownPageNavigator(): Promise<
  (url: string) => Promise<HTMLElement>
> {
  const harness = await RouterTestingHarness.create();
  const loader = TestBed.inject(TranslationLoaderService);
  const translation = TestBed.inject(TranslationService);

  return async (url) => {
    // Before the navigation rather than after, so the page's first render
    // already has the table. The import is cached, so a second navigation
    // through this harness costs nothing.
    await loader.getTranslation(translation.getActiveLang());

    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
    return harness.routeNativeElement!;
  };
}
