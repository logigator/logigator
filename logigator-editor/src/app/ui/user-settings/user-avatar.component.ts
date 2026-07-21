import { Component, computed, inject, input } from '@angular/core';
import { LgAvatar } from '@logigator/ui';
import { UserService } from '../../user/user.service';

/**
 * The signed-in user's avatar — photo, else username initial — or the generic
 * placeholder when signed out.
 */
@Component({
  selector: 'app-user-avatar',
  imports: [LgAvatar],
  host: { class: 'contents' },
  template: `
    @if (userService.user()) {
      <lg-avatar
        [image]="imageUrl()"
        [label]="imageUrl() ? undefined : initial()"
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

  protected readonly imageUrl = computed(
    () => this.userService.user()?.image?.publicUrl ?? undefined
  );
  protected readonly initial = computed(
    () => this.userService.user()?.username.slice(0, 1).toUpperCase() ?? ''
  );
}
