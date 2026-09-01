import { Component, computed, input, output } from '@angular/core';
import { LgAvatar } from '../avatar/avatar';
import { LgDivider } from '../divider/divider';
import { LgRipple } from '../ripple/ripple';
import { MenuItem } from '../menu/menu-item.model';
import { LgImageSource } from '../../tokens/image-source';

/**
 * The account panel: an avatar header naming the signed-in account, the
 * projected settings sections, and the account action rows from `model`.
 *
 * The header, the divider rhythm and the row treatment are the shared part;
 * the sections are projected because they differ per app (a website's language
 * control has to be links, an editor carries its own settings). `action` fires
 * after a row's `command`, so a hosting overlay can dismiss itself — a section
 * never fires it, and changing a setting leaves the panel open.
 *
 * Rendered by {@link LgUserControl} inside its menu, and directly wherever the
 * panel is the whole surface, as a compact sheet.
 */
@Component({
  selector: 'lg-user-panel',
  imports: [LgAvatar, LgDivider, LgRipple],
  host: { class: 'block min-w-68' },
  template: `
    <div class="flex flex-col items-center gap-2 px-4 pt-4">
      <!-- The fallback chain is the avatar's own: the picture, else the
           username's initial, else the anonymous mark. -->
      <lg-avatar
        size="xlarge"
        shape="circle"
        icon="ph ph-user"
        [image]="image()"
        [label]="initial()"
      />
      @if (username(); as name) {
        <span class="text-lg font-semibold">{{ name }}</span>
      } @else {
        <span class="text-sm">{{ signedOutLabel() }}</span>
      }
    </div>

    <lg-divider class="my-4" />

    <div class="flex flex-col gap-4 px-4 pb-4">
      <ng-content />
    </div>

    <lg-divider class="mb-1" />

    @for (item of model(); track $index) {
      @if (item.visible !== false) {
        @if (item.separator) {
          <lg-divider class="my-1" />
        } @else {
          <button
            type="button"
            lgRipple
            class="flex w-full cursor-pointer items-center gap-2 rounded px-3 py-2 text-left text-text hover:bg-content-hover disabled:pointer-events-none disabled:opacity-50"
            [disabled]="item.disabled"
            (click)="run(item)"
          >
            @if (item.icon) {
              <i [class]="item.icon" aria-hidden="true"></i>
            }
            <span>{{ item.label }}</span>
          </button>
        }
      }
    }
  `
})
export class LgUserPanel {
  /** The signed-in account's name; unset renders the anonymous header. */
  readonly username = input<string>();
  /** Header caption for a visitor with no session. */
  readonly signedOutLabel = input.required<string>();
  readonly image = input<string | readonly LgImageSource[]>();
  /** The account action rows — sign in, sign out, account settings. */
  readonly model = input<readonly MenuItem[]>([]);
  /** A row ran. */
  readonly action = output<void>();

  protected readonly initial = computed(() =>
    this.username()?.slice(0, 1).toUpperCase()
  );

  protected run(item: MenuItem): void {
    item.command?.({ item });
    this.action.emit();
  }
}
