import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UnsavedChangesGuard } from './unsaved-changes.guard';
import { ProjectMetadataStore } from './project-metadata.store';

describe('UnsavedChangesGuard', () => {
  let guard: UnsavedChangesGuard;
  let anyDirty: ReturnType<typeof signal<boolean>>;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    anyDirty = signal(false);

    TestBed.configureTestingModule({
      providers: [
        UnsavedChangesGuard,
        {
          provide: ProjectMetadataStore,
          useValue: { anyDirty: anyDirty.asReadonly() }
        }
      ]
    });
    guard = TestBed.inject(UnsavedChangesGuard);

    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    guard.detach();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  describe('attach', () => {
    it('registers a beforeunload listener on window', () => {
      guard.attach();
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('is idempotent', () => {
      guard.attach();
      guard.attach();
      guard.attach();
      expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    });

    it('handler does nothing when no project is dirty', () => {
      guard.attach();
      const handler = addEventListenerSpy.mock.calls[0][1] as (
        e: BeforeUnloadEvent
      ) => void;

      const event = new Event('beforeunload') as BeforeUnloadEvent;
      vi.spyOn(event, 'preventDefault');

      handler(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('handler calls preventDefault when any project is dirty', () => {
      anyDirty.set(true);
      guard.attach();
      const handler = addEventListenerSpy.mock.calls[0][1] as (
        e: BeforeUnloadEvent
      ) => void;

      const event = new Event('beforeunload') as BeforeUnloadEvent;
      vi.spyOn(event, 'preventDefault');

      handler(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('detach', () => {
    it('removes the listener from window', () => {
      guard.attach();
      guard.detach();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('is idempotent', () => {
      guard.attach();
      guard.detach();
      guard.detach();
      guard.detach();
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when attach was never called', () => {
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });
  });
});
