import type { SocialPlatform } from '@logigator/core';

/**
 * The glyph each platform draws as, in Phosphor's class vocabulary — the icon
 * font the site already loads, so a profile link costs no new dependency, no
 * new asset and no inline SVG.
 *
 * The record is **total** over the platform union, which is the point of it:
 * adding a platform to `@logigator/core` fails this file's type-check until the
 * new platform has a glyph. An omission cannot quietly render as a different
 * platform's logo, because a missing key is a compile error rather than a
 * fallback.
 *
 * The glyph vocabulary is narrower than the platform table, deliberately: the
 * maker and electronics platforms this audience is on — Bluesky, Hackaday,
 * Hackster, Printables, Codeberg, Thingiverse — have no Phosphor logo, and they
 * keep their entry with the generic glyph. A link is still *named* by its
 * platform's label there, which is the win; the icon is decoration beside it.
 */
export const SOCIAL_ICONS: Record<SocialPlatform, string> = {
  github: 'ph ph-github-logo',
  gitlab: 'ph ph-gitlab-logo',
  codeberg: 'ph ph-link',
  youtube: 'ph ph-youtube-logo',
  x: 'ph ph-x-logo',
  twitter: 'ph ph-twitter-logo',
  linkedin: 'ph ph-linkedin-logo',
  mastodon: 'ph ph-mastodon-logo',
  reddit: 'ph ph-reddit-logo',
  discord: 'ph ph-discord-logo',
  twitch: 'ph ph-twitch-logo',
  tiktok: 'ph ph-tiktok-logo',
  instagram: 'ph ph-instagram-logo',
  facebook: 'ph ph-facebook-logo',
  threads: 'ph ph-threads-logo',
  bluesky: 'ph ph-link',
  devto: 'ph ph-dev-to-logo',
  medium: 'ph ph-medium-logo',
  stackoverflow: 'ph ph-stack-overflow-logo',
  codepen: 'ph ph-codepen-logo',
  dribbble: 'ph ph-dribbble-logo',
  behance: 'ph ph-behance-logo',
  patreon: 'ph ph-patreon-logo',
  soundcloud: 'ph ph-soundcloud-logo',
  telegram: 'ph ph-telegram-logo',
  hackaday: 'ph ph-link',
  hackster: 'ph ph-link',
  printables: 'ph ph-link',
  thingiverse: 'ph ph-link',
  /** A host the table does not know, which is named by its host. */
  other: 'ph ph-link'
};
