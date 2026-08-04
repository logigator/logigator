import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      expect(service.binding(action)()).toEqual(DEFAULT_SHORTCUTS[action]);
    }
  });

  it('should update binding when setBinding is called', () => {
    const newBinding: ShortcutBinding = {
      key: 'q',
      ctrl: false,
      shift: false,
      alt: false
    };
    service.setBinding(ShortcutActionEnum.COPY, newBinding);
    expect(service.binding(ShortcutActionEnum.COPY)()).toEqual(newBinding);
  });

  it('should silently unassign conflicting action on setBinding', () => {
    const saveBinding = { ...DEFAULT_SHORTCUTS[ShortcutActionEnum.SAVE] };
    service.setBinding(ShortcutActionEnum.COPY, saveBinding);

    expect(service.binding(ShortcutActionEnum.SAVE)()).toBeNull();
    expect(service.binding(ShortcutActionEnum.COPY)()).toEqual(saveBinding);
    expect(messageAdd).toHaveBeenCalledOnce();
  });

  it('should reset a single binding to default', () => {
    service.setBinding(ShortcutActionEnum.COPY, {
      key: 'q',
      ctrl: false,
      shift: false,
      alt: false
    });
    service.resetBinding(ShortcutActionEnum.COPY);
    expect(service.binding(ShortcutActionEnum.COPY)()).toEqual(
      DEFAULT_SHORTCUTS[ShortcutActionEnum.COPY]
    );
  });

  it('should reset all bindings to defaults', () => {
    service.setBinding(ShortcutActionEnum.COPY, {
      key: 'q',
      ctrl: false,
      shift: false,
      alt: false
    });
    service.resetAll();
    for (const action of Object.values(ShortcutActionEnum)) {
      expect(service.binding(action)()).toEqual(DEFAULT_SHORTCUTS[action]);
    }
  });

  it('should emit from on() when matching key event fires', () =>
    new Promise<void>((resolve) => {
      const undoDefault = DEFAULT_SHORTCUTS[ShortcutActionEnum.UNDO];
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

    const copyDefault = DEFAULT_SHORTCUTS[ShortcutActionEnum.COPY]!;
    window.dispatchEvent(
      makeKeyEvent(copyDefault.key, { ctrlKey: copyDefault.ctrl })
    );
    const undoDefault = DEFAULT_SHORTCUTS[ShortcutActionEnum.UNDO]!;
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

    // The matching keyup goes to another window (alt-tab) — blur must not
    // leave the key stuck held.
    window.dispatchEvent(new Event('blur'));
    expect(service.isHeld(ShortcutActionEnum.SELECT_SCISSOR)).toBe(false);
  });

  it('isHeld follows a rebinding to a plain letter key', () => {
    service.setBinding(ShortcutActionEnum.SELECT_SCISSOR, {
      key: 'x',
      ctrl: false,
      shift: false,
      alt: false
    });

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
    service.setBinding(ShortcutActionEnum.COPY, newBinding);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored[ShortcutActionEnum.COPY]).toEqual(newBinding);
  });
});
