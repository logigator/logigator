import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { socialHost, socialLinkLabel } from '@logigator/core';
import { LgAvatar, LgMarkdown } from '@logigator/ui';
import { SiteLinks } from '../../layout/site-links';
import { SOCIAL_ICONS } from './social-icons';
import { SectionError } from '../../states/section-error';
import { NotFoundPage } from '../not-found/not-found-page';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { ProfileSection, ProfileService } from './profile.service';

/** The four tabs, in the order they are offered, with the path each takes. */
const TABS = [
  {
    section: 'projects',
    labelKey: 'pages.community.profile.projects',
    path: ''
  },
  {
    section: 'components',
    labelKey: 'pages.community.profile.components',
    path: 'components'
  },
  {
    section: 'starred-projects',
    labelKey: 'pages.community.profile.starredProjects',
    path: 'starred/projects'
  },
  {
    section: 'starred-components',
    labelKey: 'pages.community.profile.starredComponents',
    path: 'starred/components'
  }
] as const;

/**
 * A member's public page: the header every tab shares, and the tab's own
 * listing below it through the outlet.
 *
 * The four tabs are four routes rather than one page with a parameter, so each
 * is a URL a guard resolves, a crawler indexes and a link can name — and the
 * header is resolved once, on this route, so switching tabs re-reads only the
 * list.
 */
@Component({
  selector: 'web-profile-page',
  imports: [
    LgAvatar,
    LgMarkdown,
    NotFoundPage,
    RouterLink,
    RouterOutlet,
    SectionError,
    TranslateDirective
  ],
  templateUrl: './profile-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePage {
  private readonly content = inject(ProfileService);
  private readonly translation = inject(TranslationService);

  protected readonly links = inject(SiteLinks);
  protected readonly profile = this.content.profile;
  protected readonly missing = this.content.missing;
  protected readonly failureKey = this.content.failureKey;
  protected readonly retrying = this.content.retrying;

  protected readonly initials = computed(() =>
    (this.profile()?.username ?? '').slice(0, 2).toUpperCase()
  );

  /** A membership date is a calendar date; UTC, so no zone renames the day. */
  protected readonly memberSince = computed(() => {
    const profile = this.profile();
    return profile
      ? new Intl.DateTimeFormat(this.translation.activeLang(), {
          year: 'numeric',
          month: 'long',
          timeZone: 'UTC'
        }).format(new Date(profile.memberSince))
      : '';
  });

  /**
   * The member's own site, and the host to show for it. The text is the host
   * and never the stored URL: a URL printed whole is a line nobody reads, and
   * the host is the part that says where the link goes. What it came from is
   * stored, so `socialHost` is a derivation rather than a second guess.
   */
  protected readonly website = computed(() => {
    const url = this.profile()?.websiteUrl;
    return url ? { url, host: socialHost(url) } : null;
  });

  /**
   * The three slots as the strip draws them: order is the member's, the name is
   * the platform's proper noun or the link's own host, and the glyph is the
   * site's.
   *
   * Nothing here is a translation key. A platform's label is a brand name and a
   * fallback's is a hostname — both are the same in every language, which is
   * also why the strip needs no locale table.
   */
  protected readonly socials = computed(() =>
    (this.profile()?.socialLinks ?? []).map((link) => ({
      ...link,
      label: socialLinkLabel(link.platform, link.url),
      // Indexed by a platform the contract typed off the same table, so a
      // platform added to core is a missing glyph here rather than a cast.
      icon: SOCIAL_ICONS[link.platform]
    }))
  );

  protected readonly counts = computed(() => {
    const profile = this.profile();
    if (!profile) return null;
    const number = new Intl.NumberFormat(this.translation.activeLang());
    return {
      projects: number.format(profile.publicProjects),
      components: number.format(profile.publicComponents),
      stars: number.format(profile.stars)
    };
  });

  protected readonly tabs = computed(() => {
    const profile = this.profile();
    const active = this.content.section();
    return TABS.map((tab) => ({
      section: tab.section as ProfileSection,
      labelKey: tab.labelKey,
      active: tab.section === active,
      href: profile ? this.links.communityUserSection(profile.id, tab.path) : ''
    }));
  });

  protected retry(): Promise<void> {
    return this.content.retryProfile();
  }

  protected tabClass(active: boolean): string {
    return (
      '-mb-px border-b-2 px-1 pb-2.5 text-sm font-medium whitespace-nowrap ' +
      (active
        ? 'border-primary text-text-hover'
        : 'border-transparent text-muted hover:border-border hover:text-text')
    );
  }
}
