import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMarkdown } from 'ngx-markdown';
import {
  headingSlug,
  LgMarkdown,
  LgMarkdownLinkClick,
  resolveMarkdownUrls
} from './markdown';

describe('resolveMarkdownUrls', () => {
  const urls = {
    'images/intro-banner.png': 'media/intro-banner-H4SH.png',
    'files/manual.pdf': 'media/manual-H4SH.pdf'
  };

  it('replaces mapped image and link destinations, preserving alt and label', () => {
    const md =
      '![The editor at a glance](images/intro-banner.png)\n' +
      'Download the [manual](files/manual.pdf).';
    expect(resolveMarkdownUrls(md, urls)).toBe(
      '![The editor at a glance](media/intro-banner-H4SH.png)\n' +
        'Download the [manual](media/manual-H4SH.pdf).'
    );
  });

  it('keeps unmapped, empty and external destinations untouched', () => {
    const md =
      '![placeholder]()\n' +
      '![missing](images/not-registered.png)\n' +
      '[site](https://logigator.com)';
    expect(resolveMarkdownUrls(md, urls)).toBe(md);
  });

  it('carries a link title over to the mapped destination', () => {
    expect(
      resolveMarkdownUrls('![alt](images/intro-banner.png "The editor")', urls)
    ).toBe('![alt](media/intro-banner-H4SH.png "The editor")');
  });

  it('matches destinations verbatim, not inherited object properties', () => {
    expect(resolveMarkdownUrls('[a](constructor)', urls)).toBe(
      '[a](constructor)'
    );
  });
});

describe('headingSlug', () => {
  it('lowercases and joins words with dashes', () => {
    expect(headingSlug('Speed Modes')).toBe('speed-modes');
  });

  it('collapses punctuation runs and trims edge dashes', () => {
    expect(headingSlug('  Wires & Connections! ')).toBe('wires-connections');
  });

  it('keeps non-latin letters and digits', () => {
    expect(headingSlug('Größe 2×4')).toBe('größe-2-4');
  });
});

describe('LgMarkdown content interaction', () => {
  @Component({
    imports: [LgMarkdown],
    template: `<lg-markdown [data]="data" (linkClick)="handle($event)" />`
  })
  class HostComponent {
    data =
      '# Speed Modes\n\n' +
      '[jump](#speed-modes)\n\n' +
      '[site](https://logigator.com/features)\n\n' +
      '[page](docs:settings)\n\n' +
      '[mail](mailto:hi@logigator.com)\n\n' +
      '[bad](javascript:alert(1))\n\n' +
      '![Shot](shot.png)\n\n' +
      '[![Linked shot](linked.png)](https://logigator.com/linked)';
    events: LgMarkdownLinkClick[] = [];
    handle = (event: LgMarkdownLinkClick): void => {
      this.events.push(event);
    };
  }

  async function setup() {
    TestBed.configureTestingModule({ providers: [provideMarkdown()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    // ngx-markdown assigns the parsed innerHTML asynchronously.
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    const host = fixture.componentInstance;
    const el = fixture.nativeElement as HTMLElement;
    const link = (href: string) =>
      Array.from(el.querySelectorAll('a')).find((a) =>
        (a.getAttribute('href') ?? '').endsWith(href)
      )!;
    const click = (anchor: HTMLAnchorElement) =>
      anchor.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    return { fixture, host, el, link, click };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((container) => container.remove());
  });

  it('opens web links in a new tab instead of navigating the app', async () => {
    const { link, click } = await setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const navigated = click(link('https://logigator.com/features'));
    expect(navigated).toBe(false);
    expect(open).toHaveBeenCalledWith(
      'https://logigator.com/features',
      '_blank',
      'noopener'
    );
  });

  it('scrolls to the matching heading on a fragment link', async () => {
    const { el, link, click } = await setup();
    const heading = el.querySelector('h1')!;
    heading.scrollIntoView = vi.fn();
    const navigated = click(link('#speed-modes'));
    expect(navigated).toBe(false);
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('resolves a fragment the renderer percent-encoded', async () => {
    // marked encodes a destination, so a heading whose slug carries a
    // non-ASCII letter — every language but English has them — reaches the
    // handler as %XX escapes rather than as the slug it was written as.
    @Component({
      imports: [LgMarkdown],
      template: `<lg-markdown [data]="data" />`
    })
    class NonAsciiHost {
      data = '# Größe 2×4\n\n[jump](#größe-2-4)';
    }

    TestBed.configureTestingModule({ providers: [provideMarkdown()] });
    const fixture = TestBed.createComponent(NonAsciiHost);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));

    const el = fixture.nativeElement as HTMLElement;
    const anchor = el.querySelector('a')!;
    expect(anchor.getAttribute('href')).toBe('#gr%C3%B6%C3%9Fe-2-4');

    const heading = el.querySelector('h1')!;
    heading.scrollIntoView = vi.fn();
    anchor.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  });

  it('emits app-specific schemes and keeps them inert when unclaimed', async () => {
    const { host, link, click } = await setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const navigated = click(link('docs:settings'));
    expect(navigated).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect(host.events.map((event) => event.href)).toEqual(['docs:settings']);
  });

  it('never navigates the sanitizer-defused javascript: links', async () => {
    const { link, click } = await setup();
    const anchor = link('javascript:alert(1)');
    expect(anchor.getAttribute('href')).toBe('unsafe:javascript:alert(1)');
    const navigated = click(anchor);
    expect(navigated).toBe(false);
  });

  it('skips the built-in handling when the listener claims the click', async () => {
    const { host, link, click } = await setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    host.handle = (event) => event.preventDefault();
    const navigated = click(link('https://logigator.com/features'));
    expect(navigated).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('leaves sanitizer-allowed non-web schemes to native navigation', async () => {
    const { link, click } = await setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const navigated = click(link('mailto:hi@logigator.com'));
    expect(navigated).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens a clicked content image full-size, with its own src and alt', async () => {
    const { el, fixture } = await setup();
    const image = el.querySelector('img[alt=Shot]')!;
    image.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    fixture.detectChanges();

    const enlarged = document.querySelector('.cdk-overlay-container img');
    expect(enlarged?.getAttribute('src')).toContain('shot.png');
    expect((enlarged as HTMLImageElement).alt).toBe('Shot');
  });

  it('makes a loaded image keyboard-reachable and opens it on Enter', async () => {
    const { el, fixture } = await setup();
    const image = el.querySelector('img[alt=Shot]') as HTMLImageElement;
    image.dispatchEvent(new Event('load'));
    expect(image.tabIndex).toBe(0);
    expect(image.getAttribute('role')).toBe('button');

    image.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    fixture.detectChanges();

    expect(document.querySelector('.cdk-overlay-container img')).not.toBeNull();
  });

  it('lets an image wrapped in a link act as the link, not a zoom trigger', async () => {
    const { el, fixture } = await setup();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const image = el.querySelector('a img') as HTMLImageElement;
    image.dispatchEvent(new Event('load'));
    expect(image.tabIndex).not.toBe(0);
    expect(image.getAttribute('role')).toBeNull();

    image.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    fixture.detectChanges();

    expect(open).toHaveBeenCalledWith(
      'https://logigator.com/linked',
      '_blank',
      'noopener'
    );
    expect(document.querySelector('.cdk-overlay-container img')).toBeNull();
  });

  it('scrollToHeading targets headings by their text slug', async () => {
    const { fixture, el } = await setup();
    const heading = el.querySelector('h1')!;
    heading.scrollIntoView = vi.fn();
    const markdown = fixture.debugElement.query(By.directive(LgMarkdown))
      .componentInstance as LgMarkdown;
    markdown.scrollToHeading('speed-modes');
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    markdown.scrollToHeading('not-a-heading');
    expect(heading.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
