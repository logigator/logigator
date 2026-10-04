import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DialogService } from '@logigator/ui';
import { Subject } from 'rxjs';
import { configureTestBed } from '../../testing/configure-test-bed';
import { TranslationService } from '../translation/translation.service';
import { docPageUrl } from './docs-pages';
import { DocumentationService } from './documentation.service';

describe('DocumentationService', () => {
  let service: DocumentationService;
  let open: ReturnType<typeof vi.fn>;
  let closes: Subject<unknown>[];

  beforeEach(() => {
    closes = [];
    open = vi.fn(() => {
      const onClose = new Subject<unknown>();
      closes.push(onClose);
      return { onClose };
    });
    configureTestBed([{ provide: DialogService, useValue: { open } }]);
    service = TestBed.inject(DocumentationService);
  });

  it('starts at the topic index when opened without a page', () => {
    service.open();
    expect(open).toHaveBeenCalledTimes(1);
    expect(service.page()).toBeNull();
  });

  it('switches the page on later calls instead of stacking dialogs', () => {
    service.open('cloud');
    service.open('simulation');
    expect(open).toHaveBeenCalledTimes(1);
    expect(service.page()).toBe('simulation');
  });

  it('keeps the shown page when reopened without a target while open', () => {
    service.open('cloud');
    service.open();
    expect(service.page()).toBe('cloud');
  });

  it('holds a deep-link anchor until it is consumed', () => {
    service.open('simulation', 'speed-modes');
    expect(service.anchor()).toBe('speed-modes');
    service.clearAnchor();
    expect(service.anchor()).toBeNull();
    expect(service.page()).toBe('simulation');
  });

  it('resets to the index once the dialog closes and can reopen', () => {
    service.open('cloud');
    closes[0].next(undefined);
    expect(service.page()).toBeNull();

    service.open('shortcuts');
    expect(open).toHaveBeenCalledTimes(2);
    expect(service.page()).toBe('shortcuts');
  });

  it('resolves the markdown for a translated language', () => {
    TestBed.inject(TranslationService).setActiveLang('de');
    expect(service.resolveUrl('getting-started')).toBe(
      docPageUrl('getting-started', 'de')
    );
  });

  it('falls back to the English markdown for a language without one', () => {
    TestBed.inject(TranslationService).setActiveLang('it');
    expect(service.resolveUrl('getting-started')).toBe(
      docPageUrl('getting-started', 'en')
    );
  });
});
