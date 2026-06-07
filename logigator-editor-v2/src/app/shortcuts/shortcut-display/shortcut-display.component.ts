import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input
} from '@angular/core';
import { ShortcutBinding, formatKey } from '../shortcut-binding.model';
import { ShortcutService } from '../shortcut.service';

@Component({
  selector: 'app-shortcut-display',
  templateUrl: './shortcut-display.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShortcutDisplayComponent {
  protected readonly shortcutService = inject(ShortcutService);

  public readonly binding = input.required<ShortcutBinding | null>();

  protected readonly parts = computed<string[]>(() => {
    const b = this.binding();
    if (!b) return [];
    const isMac = this.shortcutService.isMac;
    const parts: string[] = [];
    if (isMac) {
      if (b.alt) parts.push('⌥');
      if (b.shift) parts.push('⇧');
      if (b.ctrl) parts.push('⌘');
    } else {
      if (b.ctrl) parts.push('Ctrl');
      if (b.shift) parts.push('Shift');
      if (b.alt) parts.push('Alt');
    }
    parts.push(formatKey(b.key));
    return parts;
  });
}
