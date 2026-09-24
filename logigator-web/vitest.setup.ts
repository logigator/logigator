// jsdom does not implement matchMedia, which @logigator/ui components read to
// answer compact-viewport questions. Specs needing a specific result override
// window.matchMedia themselves.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {
          /* empty */
        },
        removeListener: () => {
          /* empty */
        },
        addEventListener: () => {
          /* empty */
        },
        removeEventListener: () => {
          /* empty */
        },
        dispatchEvent: () => false
      }) as unknown as MediaQueryList
  });
}
