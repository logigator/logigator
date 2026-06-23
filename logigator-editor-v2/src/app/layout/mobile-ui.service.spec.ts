import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { MobileUiService } from './mobile-ui.service';

describe('MobileUiService', () => {
  let service: MobileUiService;

  beforeEach(() => {
    configureTestBed();
    service = TestBed.inject(MobileUiService);
  });

  it('starts with no sheet open', () => {
    expect(service.activeSheet()).toBeNull();
  });

  it('opens a sheet and closes it', () => {
    service.open('palette');
    expect(service.activeSheet()).toBe('palette');
    expect(service.isOpen('palette')).toBe(true);

    service.close();
    expect(service.activeSheet()).toBeNull();
  });

  it('shows only one sheet at a time', () => {
    service.open('palette');
    service.open('settings');
    expect(service.activeSheet()).toBe('settings');
    expect(service.isOpen('palette')).toBe(false);
  });

  it('toggles a sheet open and closed', () => {
    service.toggle('menu');
    expect(service.activeSheet()).toBe('menu');

    service.toggle('menu');
    expect(service.activeSheet()).toBeNull();
  });

  it('toggling a different sheet switches to it', () => {
    service.open('palette');
    service.toggle('ports');
    expect(service.activeSheet()).toBe('ports');
  });
});
