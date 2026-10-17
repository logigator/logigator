/**
 * The platforms a profile link can be recognised as, and the hosts that
 * recognise them.
 *
 * **Host strings only, and nothing else.** Classification is a lookup in a
 * table, never a request: a member may point a link at `http://169.254.169.254/`
 * or at a host only reachable from inside the network, so anything that
 * dereferenced one — an unfurl, a `HEAD`, a favicon fetch — would be textbook
 * SSRF. The same rule is why nothing downstream may render the member's typed
 * string: `https://github.com@evil.example/x` has `evil.example` for a host and
 * reads like a GitHub link.
 *
 * A `label` is a **proper noun**, identical in every language, so it is data
 * rather than a translation key — the rule the language set's endonyms follow.
 * It is what a classified link is named by, which is derived from the host
 * rather than from what was typed.
 *
 * The table is wider than the icon set the website draws: this set is what a
 * link is *recognised* as, and a platform whose glyph Phosphor does not carry
 * still earns its place, because the label is the win — a named link beats a
 * bare hostname even when it falls back to a generic icon.
 */
export const SOCIAL_PLATFORMS = [
  { id: 'github', label: 'GitHub', hosts: ['github.com', 'gist.github.com'] },
  { id: 'gitlab', label: 'GitLab', hosts: ['gitlab.com'] },
  { id: 'codeberg', label: 'Codeberg', hosts: ['codeberg.org'] },
  {
    id: 'youtube',
    label: 'YouTube',
    hosts: ['youtube.com', 'm.youtube.com', 'youtu.be']
  },
  { id: 'x', label: 'X', hosts: ['x.com', 'mobile.x.com'] },
  {
    id: 'twitter',
    label: 'Twitter',
    hosts: ['twitter.com', 'mobile.twitter.com']
  },
  { id: 'linkedin', label: 'LinkedIn', hosts: ['linkedin.com'] },
  /**
   * Federated, so there is no host that answers for all of it. A curated list
   * of the instances a member is most likely to be on; a niche one classifies
   * as `other` and is named by its host, which is the honest answer for a
   * server this table does not know.
   */
  {
    id: 'mastodon',
    label: 'Mastodon',
    hosts: [
      'mastodon.social',
      'mastodon.online',
      'mastodon.world',
      'mstdn.social',
      'fosstodon.org',
      'hachyderm.io',
      'infosec.exchange',
      'chaos.social',
      'techhub.social',
      'ioc.exchange',
      'mas.to',
      'mstdn.jp'
    ]
  },
  { id: 'reddit', label: 'Reddit', hosts: ['reddit.com', 'old.reddit.com'] },
  {
    id: 'discord',
    label: 'Discord',
    hosts: ['discord.com', 'discord.gg', 'discordapp.com']
  },
  { id: 'twitch', label: 'Twitch', hosts: ['twitch.tv'] },
  { id: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { id: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  {
    id: 'facebook',
    label: 'Facebook',
    hosts: ['facebook.com', 'fb.com', 'fb.me']
  },
  { id: 'threads', label: 'Threads', hosts: ['threads.net', 'threads.com'] },
  { id: 'bluesky', label: 'Bluesky', hosts: ['bsky.app'] },
  { id: 'devto', label: 'DEV Community', hosts: ['dev.to'] },
  { id: 'medium', label: 'Medium', hosts: ['medium.com'] },
  {
    id: 'stackoverflow',
    label: 'Stack Overflow',
    hosts: ['stackoverflow.com']
  },
  { id: 'codepen', label: 'CodePen', hosts: ['codepen.io'] },
  { id: 'dribbble', label: 'Dribbble', hosts: ['dribbble.com'] },
  { id: 'behance', label: 'Behance', hosts: ['behance.net'] },
  { id: 'patreon', label: 'Patreon', hosts: ['patreon.com'] },
  { id: 'soundcloud', label: 'SoundCloud', hosts: ['soundcloud.com'] },
  { id: 'telegram', label: 'Telegram', hosts: ['t.me', 'telegram.me'] },
  { id: 'hackaday', label: 'Hackaday', hosts: ['hackaday.io'] },
  { id: 'hackster', label: 'Hackster.io', hosts: ['hackster.io'] },
  { id: 'printables', label: 'Printables', hosts: ['printables.com'] },
  { id: 'thingiverse', label: 'Thingiverse', hosts: ['thingiverse.com'] },
  /**
   * What everything unrecognised is. A link is still stored and still shown;
   * it is named by its host rather than by a label, and the website draws its
   * generic glyph. Its `label` is never rendered — see
   * {@link socialLinkLabel} — and exists only so the table has one shape.
   */
  { id: 'other', label: 'Other', hosts: [] }
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]['id'];

/** Every host in the table, mapped to the platform it belongs to. */
const HOSTS: ReadonlyMap<string, SocialPlatform> = new Map(
  SOCIAL_PLATFORMS.flatMap((platform) =>
    platform.hosts.map((host): [string, SocialPlatform] => [host, platform.id])
  )
);

/**
 * Which platform a URL belongs to, by its host alone.
 *
 * A leading `www.` is ignored when matching, since it names nothing — but only
 * that label, and only at the front: `www.example.com.github.io` is not GitHub.
 *
 * Answers `'other'` for anything unrecognised, including a string that is not a
 * URL at all. Stored links have been through {@link normalizeSocialUrl} and
 * always parse; a caller that has not done so gets the fallback rather than a
 * throw, because neither a link nor a page should fail over a host lookup.
 */
export function classifySocialUrl(url: string): SocialPlatform {
  return HOSTS.get(socialHost(url)) ?? 'other';
}

/**
 * The label to show for a link: the platform's proper noun where it was
 * recognised, and the bare hostname where it was not.
 *
 * Derived from the host in both branches, never from the string the member
 * typed — which is the point. Printing the raw input as link text would let
 * `https://github.com@evil.example/x` read as a GitHub link on a page carrying
 * the member's name. The write path rejects that shape, and this is the second
 * layer: even if one got stored, this function could not name it GitHub.
 */
export function socialLinkLabel(platform: SocialPlatform, url: string): string {
  if (platform !== 'other') {
    return socialPlatformLabel(platform);
  }
  return socialHost(url);
}

/** The proper noun a platform is named by. Never a translation key. */
export function socialPlatformLabel(platform: SocialPlatform): string {
  return (
    SOCIAL_PLATFORMS.find((entry) => entry.id === platform)?.label ??
    // Unreachable for a platform id, which is the union of the table's own.
    'Other'
  );
}

/**
 * A URL's host, lower case, without a leading `www.` or a trailing dot, and the
 * empty string for a string that does not parse.
 *
 * Exported because it is what an unclassified link is *named* by, here and on
 * the pages: a website link shows its host rather than the URL that was typed,
 * and the `www.` this drops is the difference between a name a reader
 * recognises and the address bar they pasted from. Punycode is the parser's
 * doing, so an internationalised host arrives here in its ASCII form.
 */
export function socialHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return '';
  }
}
