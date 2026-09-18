import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  contentChild,
  input,
  signal,
  TemplateRef
} from '@angular/core';
import { LgAvatar } from '../avatar/avatar';
import { LgMenu } from '../menu/menu';
import { LgRipple } from '../ripple/ripple';
import { MenuItem } from '../menu/menu-item.model';
import { LgImageSource } from '../../tokens/image-source';
import { LgUserPanel } from './user-panel';

/**
 * The bar's account control: avatar · name · caret, opening {@link LgUserPanel}
 * as a menu. One component because this is the piece the editor's title bar and
 * the website's top bar deliberately keep identical — the bars themselves stay
 * two components, their markup being semantically different.
 *
 * The trigger takes its ink from the bar it sits in and hovers to a black
 * wash, so it reads the same on a scheme-independent bar in either scheme.
 *
 * Sections go in a `#sections` template rather than through `<ng-content>`: the
 * panel lives in an overlay that is built again on every open, and projected
 * nodes would only reach the first one.
 */
@Component({
  selector: 'lg-user-control',
  imports: [NgTemplateOutlet, LgAvatar, LgMenu, LgRipple, LgUserPanel],
  host: { class: 'contents' },
  template: `
    <button
      type="button"
      lgRipple
      aria-haspopup="menu"
      [class]="triggerClasses()"
      [attr.aria-label]="ariaLabel() ?? null"
      [attr.aria-expanded]="open()"
      (click)="menu.toggle($event)"
    >
      <lg-avatar
        shape="circle"
        icon="ph ph-user"
        [image]="image()"
        [label]="initial()"
      />
      <!-- Compact drops the name; the avatar and caret carry the control. -->
      <span class="hidden font-medium whitespace-nowrap sm:inline">{{
        username() ?? signedOutLabel()
      }}</span>
      <i class="ph ph-caret-down" aria-hidden="true"></i>
    </button>

    <lg-menu #menu (onShow)="open.set(true)" (onHide)="open.set(false)">
      <ng-template #start>
        <lg-user-panel
          [username]="username()"
          [signedOutLabel]="signedOutLabel()"
          [image]="image()"
          [model]="model()"
          (action)="menu.hide()"
        >
          @if (sections(); as tpl) {
            <ng-container *ngTemplateOutlet="tpl"></ng-container>
          }
        </lg-user-panel>
      </ng-template>
    </lg-menu>
  `
})
export class LgUserControl {
  /** The signed-in account's name; unset labels the trigger anonymous. */
  readonly username = input<string>();
  /** Trigger label and panel caption for a visitor with no session. */
  readonly signedOutLabel = input.required<string>();
  readonly image = input<string | readonly LgImageSource[]>();
  /** The panel's account action rows. */
  readonly model = input<readonly MenuItem[]>([]);
  /** Names the trigger where its label is hidden. */
  readonly ariaLabel = input<string>();

  protected readonly sections = contentChild<TemplateRef<unknown>>('sections');

  protected readonly open = signal(false);

  protected readonly initial = computed(() =>
    this.username()?.slice(0, 1).toUpperCase()
  );

  protected readonly triggerClasses = computed(
    () =>
      'flex cursor-pointer items-center gap-2 rounded px-3 py-2 transition-colors hover:bg-black/10' +
      (this.open() ? ' bg-black/10' : '')
  );
}
