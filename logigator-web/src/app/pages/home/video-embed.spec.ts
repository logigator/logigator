import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { VideoEmbed } from './video-embed';

function render() {
  const fixture = TestBed.createComponent(VideoEmbed);
  fixture.detectChanges();
  return fixture;
}

/** Every URL the rendered markup names, whatever attribute carries it. */
function urls(host: HTMLElement): string {
  return host.innerHTML;
}

describe('VideoEmbed', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
  });

  it('names nothing on a YouTube host until the visitor asks for the video', () => {
    const fixture = render();

    // A poster fetched from i.ytimg.com would be a third-party request on
    // every page view, before any consent.
    expect(urls(fixture.nativeElement)).not.toContain('youtube');
    expect(urls(fixture.nativeElement)).not.toContain('ytimg');
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
  });

  it('embeds the video for the language, once clicked', () => {
    const fixture = render();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    const src = fixture.nativeElement.querySelector('iframe').src;
    expect(src).toContain('youtube-nocookie.com/embed/weTeJLMGq_Q');
  });

  it('has its own narration in German', async () => {
    await TestBed.inject(TranslationService).setActiveLang('de');
    const fixture = render();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('iframe').src).toContain(
      '114EOH-fdLE'
    );
  });

  it('falls back to the English narration, not the German one', async () => {
    await TestBed.inject(TranslationService).setActiveLang('fr');
    const fixture = render();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('iframe').src).toContain(
      'weTeJLMGq_Q'
    );
  });
});
