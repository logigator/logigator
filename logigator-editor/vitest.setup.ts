import 'vitest-canvas-mock';

// jsdom lacks ResizeObserver, which BoardComponent uses to re-measure the
// canvas. A no-op stub keeps board instantiation from throwing in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {
      /* empty */
    }
    unobserve(): void {
      /* empty */
    }
    disconnect(): void {
      /* empty */
    }
  } as unknown as typeof ResizeObserver;
}

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

// jsdom implements neither the FontFace constructor nor document.fonts, so
// PixiJS's loadWebFont parser (AssetsService.init -> Assets.load('Roboto'))
// takes its unsupported branch and warns. Provide a no-op FontFace + font set
// so the loader follows its success path silently.
if (typeof globalThis.FontFace === 'undefined') {
  globalThis.FontFace = class {
    readonly family: string;
    constructor(family: string) {
      this.family = family;
    }
    load(): Promise<this> {
      return Promise.resolve(this);
    }
  } as unknown as typeof FontFace;
}
if (typeof document !== 'undefined' && !document.fonts) {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      add: () => {
        /* empty */
      },
      delete: () => {
        /* empty */
      },
      has: () => false
    }
  });
}
