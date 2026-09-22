import { Component, computed, inject, input } from '@angular/core';
import { LgAvatar } from '@logigator/ui';
import { UserService } from '../../user/user.service';

/**
 * The signed-in user's avatar — photo, else username initial — or the generic
 * placeholder when signed out. The fallback chain is the avatar's own, so all
 * three states are one element.
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
    <lg-avatar
      icon="ph ph-user"
      shape="circle"
      [image]="avatar()"
      [name]="userService.user()?.username"
      [size]="size()"
    />
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
}
