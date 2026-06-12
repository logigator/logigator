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
});
