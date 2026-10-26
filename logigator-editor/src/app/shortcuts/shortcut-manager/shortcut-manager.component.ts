import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DialogRef, LgButton, LgDivider, LgTooltip } from '@logigator/ui';
import { ShortcutService } from '../shortcut.service';
import { ShortcutActionEnum } from '../shortcut-action.enum';
import { ShortcutBinding, DEFAULT_SHORTCUTS } from '../shortcut-binding.model';
import { ShortcutEditComponent } from '../shortcut-edit/shortcut-edit.component';
import { TranslationKey } from '../../translation/translation-key.model';
import { TranslateDirective } from '../../translation/translate.directive';

/** How long the taken-binding hint stays up. */
const TAKEN_HINT_MS = 4000;

interface ShortcutGroup {
  labelKey: TranslationKey;
  actions: ShortcutActionEnum[];
}

@Component({
  selector: 'app-shortcut-manager',
  imports: [
    LgButton,
    LgDivider,
    LgTooltip,
    TranslateDirective,
    ShortcutEditComponent
  ],
  templateUrl: './shortcut-manager.component.html',
  styles: `
    .taken-hint-enter {
      animation: taken-hint-in 200ms ease-out;
    }
    .taken-hint-leave {
      animation: taken-hint-in 150ms ease-in reverse;
    }
    @keyframes taken-hint-in {
      from {
        opacity: 0;
        transform: translateY(0.5rem);
      }
    }
  `
})
export class ShortcutManagerComponent {
  private readonly ref = inject(DialogRef);
  protected readonly shortcutService = inject(ShortcutService);

  /**
   * The action the last binding was taken from, told in a hint floating over
   * the dialog rather than in a toast, which would sit outside it. It goes
   * after a few seconds, and any later change in the manager clears it.
   */
  protected readonly takenFrom = signal<ShortcutActionEnum | null>(null);
  private takenTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.takenTimer));
  }

  protected readonly groups: ShortcutGroup[] = [
    {
      labelKey: 'shortcuts.groups.fileOps',
      actions: [
        ShortcutActionEnum.SAVE,
        ShortcutActionEnum.OPEN,
        ShortcutActionEnum.NEW_COMPONENT
      ]
    },
    {
      labelKey: 'shortcuts.groups.editOps',
      actions: [
        ShortcutActionEnum.UNDO,
        ShortcutActionEnum.REDO,
        ShortcutActionEnum.COPY,
        ShortcutActionEnum.CUT,
        ShortcutActionEnum.PASTE,
        ShortcutActionEnum.DELETE,
        ShortcutActionEnum.ROTATE_SELECTION,
        ShortcutActionEnum.ROTATE_SELECTION_CCW,
        ShortcutActionEnum.MOVE_SELECTION_UP,
        ShortcutActionEnum.MOVE_SELECTION_DOWN,
        ShortcutActionEnum.MOVE_SELECTION_LEFT,
        ShortcutActionEnum.MOVE_SELECTION_RIGHT
      ]
    },
    {
      labelKey: 'shortcuts.groups.viewOps',
      actions: [
        ShortcutActionEnum.ZOOM_IN,
        ShortcutActionEnum.ZOOM_OUT,
        ShortcutActionEnum.ZOOM_100
      ]
    },
    {
      labelKey: 'shortcuts.groups.tools',
      actions: [
        ShortcutActionEnum.TOOL_PAN,
        ShortcutActionEnum.TOOL_WIRE,
        ShortcutActionEnum.TOOL_SELECT,
        ShortcutActionEnum.TOOL_ERASE,
        ShortcutActionEnum.TOOL_PLACE_TEXT,
        ShortcutActionEnum.SELECT_SCISSOR,
        ShortcutActionEnum.SELECT_ADDITIVE
      ]
    },
    {
      labelKey: 'shortcuts.groups.interaction',
      actions: [ShortcutActionEnum.TOGGLE_SIMULATION, ShortcutActionEnum.CANCEL]
    }
  ];

  /** The hold-style modifiers may be bound to a bare modifier key. */
  protected allowsModifierOnly(action: ShortcutActionEnum): boolean {
    return (
      action === ShortcutActionEnum.SELECT_SCISSOR ||
      action === ShortcutActionEnum.SELECT_ADDITIVE
    );
  }

  protected isDefault(action: ShortcutActionEnum): boolean {
    const current = this.shortcutService.binding(action)();
    if (!current) return false;
    const def = DEFAULT_SHORTCUTS[action];
    return (
      current.key === def.key &&
      current.ctrl === def.ctrl &&
      current.shift === def.shift &&
      current.alt === def.alt
    );
  }

  protected onBindingChange(
    action: ShortcutActionEnum,
    binding: ShortcutBinding | null
  ): void {
    this.setTakenFrom(this.shortcutService.setBinding(action, binding));
  }

  protected reset(action: ShortcutActionEnum): void {
    this.shortcutService.resetBinding(action);
    this.setTakenFrom(null);
  }

  protected unassign(action: ShortcutActionEnum): void {
    this.shortcutService.setBinding(action, null);
    this.setTakenFrom(null);
  }

  protected resetAll(): void {
    this.shortcutService.resetAll();
    this.setTakenFrom(null);
  }

  private setTakenFrom(action: ShortcutActionEnum | null): void {
    clearTimeout(this.takenTimer);
    this.takenFrom.set(action);
    if (action) {
      this.takenTimer = setTimeout(
        () => this.takenFrom.set(null),
        TAKEN_HINT_MS
      );
    }
  }

  protected close(): void {
    this.ref.close();
  }
}
