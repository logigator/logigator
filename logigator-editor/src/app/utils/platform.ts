interface NavigatorWithUAData extends Navigator {
  userAgentData?: { platform?: string };
}

/**
 * Whether this is an Apple platform, whose primary modifier is ⌘. Read where a
 * binding or a label has to name that modifier rather than a specific key.
 */
export function isApplePlatform(): boolean {
  // `userAgentData.platform` reports 'macOS' — not the 'Mac' `navigator.platform`
  // uses — so the test folds case and falls back to the deprecated property
  // only when the modern one is absent.
  const source = navigator as NavigatorWithUAData;
  const platform = source.userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}
