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

  /** The bound handler, or undefined if nothing was registered. */
  function handler(): ((e: BeforeUnloadEvent) => void) | undefined {
    const call = addEventListenerSpy.mock.calls.find(
      ([type]: unknown[]) => type === 'beforeunload'
    );
    return call?.[1] as ((e: BeforeUnloadEvent) => void) | undefined;
  }

  function unloadEvent(): BeforeUnloadEvent {
    const event = new Event('beforeunload') as BeforeUnloadEvent;
    vi.spyOn(event, 'preventDefault');
    return event;
  }

  describe('binds only while there is something to lose', () => {
    // A registered beforeunload listener disqualifies the page from bfcache
    // whether or not it fires, so a clean editor registers nothing.
    it('registers no listener while nothing is dirty', () => {
      guard.attach();
      TestBed.tick();

      expect(handler()).toBeUndefined();
    });

    it('registers the listener once a project becomes dirty', () => {
      guard.attach();
      TestBed.tick();

      anyDirty.set(true);
      TestBed.tick();

      expect(handler()).toBeDefined();
    });

    it('removes the listener again once the last change is saved', () => {
      guard.attach();
      anyDirty.set(true);
      TestBed.tick();
      removeEventListenerSpy.mockClear();

      anyDirty.set(false);
      TestBed.tick();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('does not re-register while staying dirty', () => {
      guard.attach();
      anyDirty.set(true);
      TestBed.tick();

      anyDirty.set(true);
      TestBed.tick();

      const bindings = addEventListenerSpy.mock.calls.filter(
        ([type]: unknown[]) => type === 'beforeunload'
      );
      expect(bindings).toHaveLength(1);
    });
  });

  describe('handler', () => {
    it('calls preventDefault while a project is dirty', () => {
      guard.attach();
      anyDirty.set(true);
      TestBed.tick();

      const event = unloadEvent();
      handler()!(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does nothing if it survives the project going clean', () => {
      guard.attach();
      anyDirty.set(true);
      TestBed.tick();
      const bound = handler()!;

      // Effects are scheduled, so the handler can outlive the dirty state it
      // was bound for.
      anyDirty.set(false);
      const event = unloadEvent();
      bound(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('is idempotent across repeated attach calls', () => {
      guard.attach();
      guard.attach();
      guard.attach();
      anyDirty.set(true);
      TestBed.tick();

      const bindings = addEventListenerSpy.mock.calls.filter(
        ([type]: unknown[]) => type === 'beforeunload'
      );
      expect(bindings).toHaveLength(1);
    });

    it('stops following the dirty state after detach', () => {
      guard.attach();
      guard.detach();

      anyDirty.set(true);
      TestBed.tick();

      expect(handler()).toBeUndefined();
    });

    it('is a no-op when attach was never called', () => {
      guard.detach();

      expect(addEventListenerSpy).not.toHaveBeenCalled();
      expect(removeEventListenerSpy).not.toHaveBeenCalled();
    });
  });
});
