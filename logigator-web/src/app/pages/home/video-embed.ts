import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { homeVideo, videoEmbedUrl } from './home-video';

/**
 * The YouTube explainer, behind a click: nothing reaches Google before the
 * visitor asks for it. The poster is served from this origin and the
 * `<iframe>` does not exist in the DOM until the click.
 */
@Component({
  selector: 'web-video-embed',
  imports: [TranslateDirective],
  host: { class: 'block' },
  template: `
    <ng-container *webTranslate="let t">
      @if (playing()) {
        <iframe
          class="aspect-video w-full rounded-md border border-surface-700"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerpolicy="strict-origin"
          allowfullscreen
          [title]="video().title"
          [src]="embedUrl()"
        ></iframe>
      } @else {
        <button
          type="button"
          class="group relative grid aspect-video w-full cursor-pointer place-items-center overflow-hidden rounded-md border border-surface-700"
          [attr.aria-label]="
            t('pages.home.video.play', { title: video().title })
          "
          (click)="play()"
        >
          <img
            class="absolute inset-0 h-full w-full object-cover"
            alt=""
            loading="lazy"
            [src]="video().poster"
          />
          <!-- The disc is a mid-tone green on an arbitrary frame: the ring
               separates it from the image, the shadow lifts it off. -->
          <span
            class="relative inline-flex size-16 items-center justify-center rounded-full bg-primary-400 text-surface-950 shadow-lg shadow-black/40 ring-2 ring-surface-0 transition-transform group-hover:scale-105"
          >
            <i class="ph ph-play ml-0.5 text-2xl" aria-hidden="true"></i>
          </span>
        </button>
      }
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoEmbed {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly translation = inject(TranslationService);

  protected readonly playing = signal(false);

  protected readonly video = computed(() =>
    homeVideo(this.translation.activeLang())
  );

  // Nothing a visitor can steer reaches this URL.
  protected readonly embedUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(
      `${videoEmbedUrl(this.video())}?autoplay=1&rel=0`
    )
  );

  protected play(): void {
    this.playing.set(true);
  }
}
