import { computed, Directive, inject } from '@angular/core';
import { SessionService } from '../../../user/session.service';

/**
 * The account's sign-in address, as a hidden field of a form that takes a
 * password. A password manager reads the username from the password's own
 * form: without one it cannot tell which saved sign-in a current password
 * fills or a new one replaces.
 */
@Directive({
  selector: 'input[webAccountUsername]',
  host: {
    type: 'email',
    autocomplete: 'username',
    hidden: '',
    readonly: '',
    '[attr.value]': 'email()'
  }
})
export class AccountUsername {
  private readonly session = inject(SessionService);

  protected readonly email = computed(() => this.session.user()?.email ?? '');
}
