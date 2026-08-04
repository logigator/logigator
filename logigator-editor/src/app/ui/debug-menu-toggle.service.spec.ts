import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../testing/configure-test-bed';
import { DebugMenuToggleService } from './debug-menu-toggle.service';

describe('DebugMenuToggleService', () => {
  let service: DebugMenuToggleService;

  beforeEach(() => {
    configureTestBed();
    service = TestBed.inject(DebugMenuToggleService);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    delete window.__logigatorDebug;
    vi.restoreAllMocks();
  });

  it('installs a console command that enables by default and takes false', () => {
    service.install();

    expect(window.__logigatorDebug!()).toBe(true);
    expect(service.enabled()).toBe(true);

    expect(window.__logigatorDebug!(false)).toBe(false);
    expect(service.enabled()).toBe(false);
  });
});
