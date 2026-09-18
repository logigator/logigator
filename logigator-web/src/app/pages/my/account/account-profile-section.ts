import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { firstValueFrom, Observable } from 'rxjs';
import {
  ApiRequestError,
  usernameSchema,
  type UserResponse
} from '@logigator/contract';
import {
  LgAvatar,
  LgButton,
  LgFormField,
  LgInputText,
  LgMessage
} from '@logigator/ui';
import { UserApiService } from '../../../api/services/user-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { fieldError } from '../../../forms/field-error';
import { zodValidator } from '../../../forms/zod-validator';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { SessionService } from '../../../user/session.service';
import { AccountSection } from './account-section';

/** What the API accepts, so an oversized or unreadable file is refused here
 * rather than after the upload. `image/*` would offer formats libvips is not
 * asked to decode, and an SVG it would happily rasterize is refused outright. */
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif';

/**
 * The account's public face: its username and its picture.
 *
 * Neither is gated on the password — a username is not a credential and
 * changing it moves control of nothing. The picture is re-encoded server-side
 * into the whole variant matrix, so there is no crop here: the API squares and
 * re-encodes whatever it is given, and a crop UI would be a second, weaker
 * definition of what the stored image is.
 */
@Component({
  selector: 'web-account-profile-section',
  imports: [
    AccountSection,
    LgAvatar,
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    ReactiveFormsModule,
    TranslateDirective
  ],
  templateUrl: './account-profile-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountProfileSection {
  private readonly userApi = inject(UserApiService);
  private readonly session = inject(SessionService);

  protected readonly accept = ACCEPTED_TYPES;

  // A group of one, so the `<form>` carries `[formGroup]`: a bare form with
  // only `[formControl]` inside matches no directive, and `(ngSubmit)` on it
  // would never fire.
  protected readonly form = new FormGroup({
    username: new FormControl(this.session.user()?.username ?? '', {
      nonNullable: true,
      validators: [Validators.required, zodValidator(usernameSchema)]
    })
  });

  protected readonly usernameError = fieldError(
    this.form.controls.username,
    'username'
  );

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);

  protected readonly avatarBusy = signal(false);
  protected readonly avatarError = signal<TranslationKey | null>(null);

  protected readonly avatar = computed(() => {
    const variants = this.session.user()?.avatar;
    return variants?.length ? variants : undefined;
  });

  protected readonly initials = computed(() =>
    (this.session.user()?.username ?? '').slice(0, 2).toUpperCase()
  );

  protected async submit(): Promise<void> {
    const username = this.form.controls.username;
    this.form.markAllAsTouched();
    this.formError.set(null);
    this.saved.set(false);
    const parsed = usernameSchema.safeParse(username.value);
    if (!parsed.success || this.form.invalid) return;

    this.saving.set(true);
    try {
      const result = await firstValueFrom(
        this.userApi.update({ username: parsed.data })
      );
      this.session.updated(result.user);
      username.setValue(result.user.username);
      username.markAsPristine();
      this.saved.set(true);
    } catch (error) {
      // No branch for a name somebody else has: `users.username` carries an
      // index rather than a unique constraint, so there is no such failure to
      // report and a duplicate is simply allowed.
      this.formError.set(genericFailureKey(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset first, so picking the same file twice after a failure fires again.
    input.value = '';
    if (!file || this.avatarBusy()) return;

    await this.withAvatar(() => this.userApi.setAvatar(file));
  }

  protected async removeAvatar(): Promise<void> {
    if (this.avatarBusy()) return;
    await this.withAvatar(() => this.userApi.removeAvatar());
  }

  private async withAvatar(
    write: () => Observable<UserResponse>
  ): Promise<void> {
    this.avatarBusy.set(true);
    this.avatarError.set(null);
    try {
      this.session.updated(await firstValueFrom(write()));
    } catch (error) {
      this.avatarError.set(
        error instanceof ApiRequestError &&
          (error.status === 413 || error.status === 415)
          ? 'pages.my.account.profile.avatarRejected'
          : genericFailureKey(error)
      );
    } finally {
      this.avatarBusy.set(false);
    }
  }
}
