import { RouterTestingHarness } from '@angular/router/testing';

/**
 * Navigates the one harness a test may create, and returns the rendered page.
 *
 * Every page whose body is markdown waits the same way: ngx-markdown assigns
 * the parsed `innerHTML` asynchronously, so a render is settled only after the
 * task queue has drained. Three pages need it — the documentation, the legal
 * documents and the changelog — and a wait tuned in one of them and not the
 * others is a test that passes for the wrong reason.
 *
 * Returning a navigate function rather than a page: two navigations is how a
 * language switch reaches these pages, and a harness may be created once.
 */
export async function markdownPageNavigator(): Promise<
  (url: string) => Promise<HTMLElement>
> {
  const harness = await RouterTestingHarness.create();
  return async (url) => {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
    return harness.routeNativeElement!;
  };
}
