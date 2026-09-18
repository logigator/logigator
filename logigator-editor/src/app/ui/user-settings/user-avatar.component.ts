import { Component, computed, inject, input } from '@angular/core';
import { LgAvatar } from '@logigator/ui';
import { UserService } from '../../user/user.service';

/**
 * The signed-in user's avatar — photo, else username initial — or the generic
 * placeholder when signed out.
 *
 * The API answers the whole ladder it encoded, widest-first per format and WebP
 * before its fallback, and that list reaches `lg-avatar` unchanged. Nothing
 * here chooses: the browser picks the width for its pixel ratio and the first
 * encoding it can decode.
 */
@Component({
  selector: 'app-user-avatar',
  imports: [LgAvatar],
  host: { class: 'contents' },
  template: `
    @if (userService.user()) {
      <lg-avatar
        [image]="avatar()"
        [label]="avatar() ? undefined : initial()"
        shape="circle"
        [size]="size()"
      />
    } @else {
      <lg-avatar icon="ph ph-user" shape="circle" [size]="size()" />
    }
  `
})
export class UserAvatarComponent {
  protected readonly userService = inject(UserService);

  public readonly size = input<'xlarge'>();

  // An account with no avatar answers `null`, and an empty ladder says the same
  // thing; either way the initial shows.
  protected readonly avatar = computed(() => {
    const variants = this.userService.user()?.avatar;
    return variants?.length ? variants : undefined;
  });
  protected readonly initial = computed(
    () => this.userService.user()?.username.slice(0, 1).toUpperCase() ?? ''
  );
}
