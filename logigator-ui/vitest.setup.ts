// jsdom implements no matchMedia, and several primitives read it at
// construction. A spec needing specific results overrides this itself.
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
