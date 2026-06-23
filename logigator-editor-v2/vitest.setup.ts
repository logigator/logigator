import 'vitest-canvas-mock';

// jsdom does not implement matchMedia. Several root services (LayoutService)
// and PrimeNG components read it at construction, so provide a benign default
// here. Specs that need specific media-query results override window.matchMedia
// themselves.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
      }) as unknown as MediaQueryList
  });
}
