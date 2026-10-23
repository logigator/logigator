import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DialogService, ToastService } from '@logigator/ui';
import { provideTransloco } from '@jsverse/transloco';
import { TranslationLoaderService } from '../translation/translation-loader.service';
import { ShortcutService } from './shortcut.service';
import { ShortcutActionEnum } from './shortcut-action.enum';
import { DEFAULT_SHORTCUTS, ShortcutBinding } from './shortcut-binding.model';
import { ProjectService } from '../project/project.service';
import { SaveCoordinatorService } from '../ui/save-coordinator.service';
import { ClipboardService } from '../clipboard/clipboard.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { WorkMode } from '../work-mode/work-mode.enum';

const STORAGE_KEY = 'logigator.shortcuts';

function makeKeyEvent(
  key: string,
  modifiers: Partial<{
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  }> = {}
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
    altKey: modifiers.altKey ?? false,
    bubbles: true,
    cancelable: true
  });
}

describe('ShortcutService', () => {
  let service: ShortcutService;
  let messageAdd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    messageAdd = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ShortcutService,
        { provide: ToastService, useValue: { add: messageAdd } },
        { provide: DialogService, useValue: { open: vi.fn() } },
        {
          provide: ProjectService,
          useValue: { activeProject: vi.fn().mockReturnValue(null) }
        },
        {
          provide: SaveCoordinatorService,
          useValue: { requestSave: vi.fn() }
        },
        {
          provide: ClipboardService,
          useValue: {
            copy: vi.fn(),
            cut: vi.fn(),
            paste: vi.fn(),
            delete: vi.fn()
          }
        },
        {
          provide: WorkModeService,
          useValue: {
            mode: vi.fn().mockReturnValue(WorkMode.WIRE_TOOL),
            setMode: vi.fn(),
            setSelectedComponentType: vi.fn()
          }
        },
        provideTransloco({
          config: {
            defaultLang: 'en',
            availableLangs: ['en'],
            reRenderOnLangChange: false,
            prodMode: true
          },
          loader: TranslationLoaderService
        })
      ]
    });

    service = TestBed.inject(ShortcutService);
  });

  it('should return default binding for each action', () => {
    for (const action of Object.values(ShortcutActionEnum)) {
      expect(service.bindings(action)()).toEqual(DEFAULT_SHORTCUTS[action]);
    }
  });

  it('should update binding when setBinding is called', () => {
    const newBinding: ShortcutBinding = {
      key: 'q',
      ctrl: false,
      shift: false,
      alt: false
    };
    service.setBinding(ShortcutActionEnum.COPY, [newBinding]);
    expect(service.bindings(ShortcutActionEnum.COPY)()).toEqual([newBinding]);
  });

  it('should silently unassign conflicting action on setBinding', () => {
    const saveBinding = [...DEFAULT_SHORTCUTS[ShortcutActionEnum.SAVE]];
    service.setBinding(ShortcutActionEnum.COPY, saveBinding);

    expect(service.bindings(ShortcutActionEnum.SAVE)()).toStrictEqual([]);
    expect(service.bindings(ShortcutActionEnum.COPY)()).toEqual(saveBinding);
    expect(messageAdd).toHaveBeenCalledOnce();
  });

  it('takes only the conflicting combination from an action with several', () => {
    const [del, backspace] = DEFAULT_SHORTCUTS[ShortcutActionEnum.DELETE];
    service.setBinding(ShortcutActionEnum.COPY, [backspace]);

    expect(service.bindings(ShortcutActionEnum.DELETE)()).toEqual([del]);
    expect(service.bindings(ShortcutActionEnum.COPY)()).toEqual([backspace]);
    expect(messageAdd).toHaveBeenCalledOnce();
  });

  it('takes conflicting combinations from every action that holds one', () => {
    const save = DEFAULT_SHORTCUTS[ShortcutActionEnum.SAVE][0];
    const open = DEFAULT_SHORTCUTS[ShortcutActionEnum.OPEN][0];
    service.setBinding(ShortcutActionEnum.COPY, [save, open]);

    expect(service.bindings(ShortcutActionEnum.SAVE)()).toEqual([]);
    expect(service.bindings(ShortcutActionEnum.OPEN)()).toEqual([]);
    expect(messageAdd).toHaveBeenCalledTimes(2);
  });

  it('unassigns without a reassignment toast while another action is unassigned', () => {
    service.setBinding(ShortcutActionEnum.SAVE, []);
    service.setBinding(ShortcutActionEnum.COPY, []);

    expect(service.bindings(ShortcutActionEnum.COPY)()).toEqual([]);
    expect(messageAdd).not.toHaveBeenCalled();
  });

  it('should reset a single binding to default', () => {
    service.setBinding(ShortcutActionEnum.COPY, [
      {
        key: 'q',
        ctrl: false,
        shift: false,
        alt: false
      }
    ]);
    service.resetBinding(ShortcutActionEnum.COPY);
    expect(service.bindings(ShortcutActionEnum.COPY)()).toEqual(
      DEFAULT_SHORTCUTS[ShortcutActionEnum.COPY]
    );
  });

  it('should reset all bindings to defaults', () => {
    service.setBinding(ShortcutActionEnum.COPY, [
      {
        key: 'q',
        ctrl: false,
        shift: false,
        alt: false
      }
    ]);
    service.resetAll();
    for (const action of Object.values(ShortcutActionEnum)) {
      expect(service.bindings(action)()).toEqual(DEFAULT_SHORTCUTS[action]);
    }
  });

  it('should emit from on() when matching key event fires', () =>
    new Promise<void>((resolve) => {
      const undoDefault = DEFAULT_SHORTCUTS[ShortcutActionEnum.UNDO][0];
      service.on(ShortcutActionEnum.UNDO).subscribe(() => resolve());
      window.dispatchEvent(
        makeKeyEvent(undoDefault.key, { ctrlKey: undoDefault.ctrl })
      );
    }));

  it('gates editing actions while in simulation mode', () => {
    const workMode = TestBed.inject(WorkModeService) as unknown as {
      mode: ReturnType<typeof vi.fn>;
    };
    const clipboard = TestBed.inject(ClipboardService) as unknown as {
      copy: ReturnType<typeof vi.fn>;
    };
    const projectService = TestBed.inject(ProjectService) as unknown as {
      activeProject: ReturnType<typeof vi.fn>;
    };
    const undo = vi.fn();
    projectService.activeProject.mockReturnValue({ actionManager: { undo } });
    workMode.mode.mockReturnValue(WorkMode.SIMULATION);

    const copyDefault = DEFAULT_SHORTCUTS[ShortcutActionEnum.COPY][0]!;
    window.dispatchEvent(
      makeKeyEvent(copyDefault.key, { ctrlKey: copyDefault.ctrl })
    );
    const undoDefault = DEFAULT_SHORTCUTS[ShortcutActionEnum.UNDO][0]!;
    window.dispatchEvent(
      makeKeyEvent(undoDefault.key, { ctrlKey: undoDefault.ctrl })
    );
    expect(clipboard.copy).not.toHaveBeenCalled();
    expect(undo).not.toHaveBeenCalled();

    // Leaving simulation mode unlocks the same shortcuts again.
    workMode.mode.mockReturnValue(WorkMode.SELECT);
    window.dispatchEvent(
      makeKeyEvent(undoDefault.key, { ctrlKey: undoDefault.ctrl })
    );
    expect(undo).toHaveBeenCalledOnce();
  });

  it('isHeld follows the default bare-Alt scissor binding through keydown/keyup', () => {
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(false);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Alt', altKey: true })
    );
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(false);
  });

  it('isHeld releases everything when the window loses focus', () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Alt', altKey: true })
    );
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(true);

    // The matching keyup goes to another window (alt-tab); blur must not
    // leave the key stuck held.
    window.dispatchEvent(new Event('blur'));
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(false);
  });

  it('isHeld follows a rebinding to a plain letter key', () => {
    service.setBinding(ShortcutActionEnum.SELECT_SCISSOR, [
      {
        key: 'x',
        ctrl: false,
        shift: false,
        alt: false
      }
    ]);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(true);

    // Holding an extra modifier no longer matches the exact binding.
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true })
    );
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'x' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift' }));
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(false);
  });

  it('heldChange$ fires on every held-state change', () => {
    let emissions = 0;
    const sub = service.heldChange$.subscribe(() => emissions++);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Alt', altKey: true })
    );
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }));
    window.dispatchEvent(new Event('blur'));

    expect(emissions).toBe(3);
    sub.unsubscribe();
  });

  it('should persist bindings to localStorage', () => {
    const newBinding: ShortcutBinding = {
      key: 'q',
      ctrl: false,
      shift: false,
      alt: false
    };
    service.setBinding(ShortcutActionEnum.COPY, [newBinding]);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored[ShortcutActionEnum.COPY]).toEqual([newBinding]);
  });

  describe('loading the legacy single-binding storage format', () => {
    let reloaded: ShortcutService | undefined;

    afterEach(() => {
      reloaded?.ngOnDestroy();
      reloaded = undefined;
    });

    // Storage is read once, in the constructor: swap the injected instance for
    // a fresh one built over the seeded storage.
    function reloadFrom(stored: Record<string, unknown>): ShortcutService {
      service.ngOnDestroy();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      reloaded = TestBed.runInInjectionContext(() => new ShortcutService());
      return reloaded;
    }

    // What the old _saveToStorage wrote: every action, one binding object each
    // — the pre-array default being the first entry of today's default list.
    function legacyStorage(): Record<string, ShortcutBinding | null> {
      return Object.fromEntries(
        Object.values(ShortcutActionEnum).map((a) => [
          a,
          DEFAULT_SHORTCUTS[a][0]
        ])
      );
    }

    it('loads a legacy unassigned (null) entry as no bindings', () => {
      const shortcuts = reloadFrom({ [ShortcutActionEnum.COPY]: null });

      expect(shortcuts.bindings(ShortcutActionEnum.COPY)()).toEqual([]);
    });

    it('keeps keyboard shortcuts working after loading a legacy null entry', () => {
      const shortcuts = reloadFrom({ [ShortcutActionEnum.COPY]: null });
      const undo = vi.fn();
      shortcuts.on(ShortcutActionEnum.UNDO).subscribe(undo);

      // An unbound key walks every action's bindings, COPY's included — a
      // null in there throws and tears down the keydown subscription.
      window.dispatchEvent(makeKeyEvent('q'));
      const undoDefault = DEFAULT_SHORTCUTS[ShortcutActionEnum.UNDO][0]!;
      window.dispatchEvent(
        makeKeyEvent(undoDefault.key, { ctrlKey: undoDefault.ctrl })
      );

      expect(undo).toHaveBeenCalledOnce();
    });

    it('gives DELETE its current defaults when legacy storage holds the old default', () => {
      // A user who once rebound Undo: the old save wrote every action, so
      // DELETE sits there as the old single-key default.
      const stored = legacyStorage();
      stored[ShortcutActionEnum.UNDO] = {
        key: 'u',
        ctrl: true,
        shift: false,
        alt: false
      };
      const shortcuts = reloadFrom(stored);

      expect(shortcuts.bindings(ShortcutActionEnum.DELETE)()).toEqual(
        DEFAULT_SHORTCUTS[ShortcutActionEnum.DELETE]
      );
      // The deliberate customization survives the migration.
      expect(shortcuts.bindings(ShortcutActionEnum.UNDO)()).toEqual([
        stored[ShortcutActionEnum.UNDO]
      ]);
    });

    it('deletes with Backspace after loading legacy storage', () => {
      const projectService = TestBed.inject(ProjectService) as unknown as {
        activeProject: ReturnType<typeof vi.fn>;
      };
      const clipboard = TestBed.inject(ClipboardService) as unknown as {
        delete: ReturnType<typeof vi.fn>;
      };
      const project = {};
      projectService.activeProject.mockReturnValue(project);
      reloadFrom(legacyStorage());

      window.dispatchEvent(makeKeyEvent('Backspace'));

      expect(clipboard.delete).toHaveBeenCalledExactlyOnceWith(project);
    });
  });
});
