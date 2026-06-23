import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { PersistenceService } from './persistence/persistence.service';
import { appConfig } from './app.config';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        {
          provide: Location,
          useValue: {
            path: () => '/',
            go: () => undefined,
            replaceState: () => undefined,
            subscribe: () => ({ unsubscribe: () => undefined })
          }
        },
        {
          provide: PersistenceService,
          useValue: {
            preloadBrowserMasters: vi.fn().mockResolvedValue(undefined),
            createAndSetEmptyProject: vi.fn(),
            registerOpenProject: vi.fn()
          }
        }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the desktop shell at the default (non-compact) breakpoint', () => {
    // matchMedia is stubbed to matches:false (vitest.setup.ts), so isCompact is
    // false and the shell takes its desktop branch.
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-title-bar')).not.toBeNull();
    expect(el.querySelector('app-tool-bar')).not.toBeNull();
    expect(el.querySelector('app-board')).not.toBeNull();
    expect(el.querySelector('app-mobile-top-bar')).toBeNull();
    expect(el.querySelector('app-tool-hud')).toBeNull();
  });

  it('renders the mobile shell (and single board) when compact', () => {
    // Force the compact breakpoint before LayoutService reads matchMedia.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) =>
        ({
          matches: query.includes('max-width'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }) as unknown as MediaQueryList
    });

    const fixture = TestBed.createComponent(AppComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-mobile-top-bar')).not.toBeNull();
    expect(el.querySelector('app-tool-hud')).not.toBeNull();
    expect(el.querySelector('app-title-bar')).toBeNull();
    // The canvas is never duplicated across the breakpoint branches.
    expect(el.querySelectorAll('app-board').length).toBe(1);
  });
});
