import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoDirective } from '@jsverse/transloco';
import { ShortcutService } from '../shortcut.service';
import { ShortcutActionEnum } from '../shortcut-action.enum';
import { ShortcutBinding, DEFAULT_SHORTCUTS } from '../shortcut-binding.model';
import { ShortcutEditComponent } from '../shortcut-edit/shortcut-edit.component';
import { TranslationKey } from '../../translation/translation-key.model';

interface ShortcutGroup {
  labelKey: TranslationKey;
  actions: ShortcutActionEnum[];
}

@Component({
  selector: 'app-shortcut-manager',
  imports: [
    ButtonModule,
    DividerModule,
    TooltipModule,
    TranslocoDirective,
    ShortcutEditComponent
  ],
  templateUrl: './shortcut-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShortcutManagerComponent {
  private readonly ref = inject(DynamicDialogRef);
  protected readonly shortcutService = inject(ShortcutService);

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
        ShortcutActionEnum.DELETE
      ]
    },
    {
      labelKey: 'shortcuts.groups.viewOps',
      actions: [ShortcutActionEnum.ZOOM_IN, ShortcutActionEnum.ZOOM_OUT]
    },
    {
      labelKey: 'shortcuts.groups.tools',
      actions: [
        ShortcutActionEnum.TOOL_WIRE_DRAWING,
        ShortcutActionEnum.TOOL_WIRE_CONNECTION,
        ShortcutActionEnum.TOOL_SELECT,
        ShortcutActionEnum.TOOL_SELECT_EXACT,
        ShortcutActionEnum.TOOL_ERASE,
        ShortcutActionEnum.TOOL_COMPONENT_PLACEMENT,
        ShortcutActionEnum.TOOL_PLACE_TEXT
      ]
    },
    {
      labelKey: 'shortcuts.groups.interaction',
      actions: [ShortcutActionEnum.CANCEL]
    }
  ];

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
    this.shortcutService.setBinding(action, binding);
  }

  protected resetAll(): void {
    this.shortcutService.resetAll();
  }

  protected close(): void {
    this.ref.close();
  }
}
