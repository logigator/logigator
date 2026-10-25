/**
 * The browser families the editor is tested against, and the oldest release of
 * each it is built for.
 *
 * Tailwind 4 sets the floor: the generated stylesheet leans on `@property` and
 * `color-mix()` throughout, and `@property` is what puts Gecko at 128. Module
 * workers (Gecko 114) sit below the same line, so one range covers the
 * simulation worker as well. The floor stays at or under the current Firefox
 * ESR, so an ESR user is never warned.
 *
 * This is a support policy, kept deliberately apart from the build's
 * browserslist query: that query resolves to the last two releases of each
 * engine, and warning everyone a few versions behind would be noise.
 */
const MINIMUM_VERSION = {
  chromium: [111, 0],
  firefox: [128, 0],
  safari: [16, 4]
} as const satisfies Record<BrowserFamily, readonly [number, number]>;

/** The engine a user agent is attributed to. Every browser is one of three. */
export type BrowserFamily = 'chromium' | 'firefox' | 'safari';

export type UnsupportedReason = 'outdated' | 'unrecognized';

export interface BrowserSupportVerdict {
  supported: boolean;
  /** `'unknown'` when nothing in the user agent identifies an engine. */
  family: BrowserFamily | 'unknown';
  /**
   * Detected version, `0.0` for an unidentified engine. On iOS this is the OS
   * version: every browser there runs the system WebKit, and Chrome, Firefox
   * and Edge report a version naming their own shell rather than the engine.
   */
  major: number;
  minor: number;
  reason?: UnsupportedReason;
}

/**
 * Reads a user agent and decides whether it falls inside
 * {@link MINIMUM_VERSION}. An engine the parser cannot name counts as
 * unsupported: "officially supported" is a list, and absence from it is what
 * the verdict reports.
 */
export function detectBrowserSupport(userAgent: string): BrowserSupportVerdict {
  const detected = detectBrowser(userAgent);
  if (!detected) {
    return {
      supported: false,
      family: 'unknown',
      major: 0,
      minor: 0,
      reason: 'unrecognized'
    };
  }
  const [minMajor, minMinor] = MINIMUM_VERSION[detected.family];
  const supported =
    detected.major > minMajor ||
    (detected.major === minMajor && detected.minor >= minMinor);
  return supported
    ? { ...detected, supported: true }
    : { ...detected, supported: false, reason: 'outdated' };
}

interface DetectedBrowser {
  family: BrowserFamily;
  major: number;
  minor: number;
}

function detectBrowser(userAgent: string): DetectedBrowser | null {
  // iOS comes first. Every browser there runs the system WebKit, and Chrome,
  // Firefox and Edge identify themselves as `CriOS`/`FxiOS`/`EdgiOS` with their
  // own branded version and no `Version/` token at all, so the OS version is
  // the only thing that names the engine. iPadOS 13+ sends a desktop macOS user
  // agent and lands on the Safari branch below, where `Version/` is accurate.
  const ios = /(?:iPhone|iPad|iPod)[^)]*?OS (\d+)[._](\d+)/.exec(userAgent);
  if (ios) {
    return { family: 'safari', major: Number(ios[1]), minor: Number(ios[2]) };
  }

  // Every Chromium skin keeps a `Chrome/` token carrying the real engine
  // version: Edge, Opera and Samsung Internet add `Edg/`, `OPR/` and
  // `SamsungBrowser/` beside it, while Brave, Vivaldi and Arc are
  // indistinguishable from Chrome. Read before Safari, because a skin can carry
  // a `Version/` token too.
  const chromium = /(?:Chrome|Chromium)\/(\d+)\.(\d+)/.exec(userAgent);
  if (chromium) {
    return {
      family: 'chromium',
      major: Number(chromium[1]),
      minor: Number(chromium[2])
    };
  }

  // Gecko forks — LibreWolf, Waterfox, Tor Browser — all keep `Firefox/`.
  const firefox = /Firefox\/(\d+)\.(\d+)/.exec(userAgent);
  if (firefox) {
    return {
      family: 'firefox',
      major: Number(firefox[1]),
      minor: Number(firefox[2])
    };
  }

  const safari = /Version\/(\d+)\.(\d+)(?:\.\d+)? Safari\//.exec(userAgent);
  if (safari) {
    return {
      family: 'safari',
      major: Number(safari[1]),
      minor: Number(safari[2])
    };
  }

  return null;
}
