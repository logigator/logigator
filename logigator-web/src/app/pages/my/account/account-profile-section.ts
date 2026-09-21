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
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, Observable } from 'rxjs';
import {
  ApiRequestError,
  bioSchema,
  socialUrlSchema,
  updateUserRequestSchema,
  usernameSchema,
  type SocialLink,
  type UserResponse
} from '@logigator/contract';
import {
  LgAvatar,
  LgButton,
  LgFormField,
  LgInputText,
  LgMarkdownField,
  LgMessage,
  LgTextarea
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
 * The three link slots. Named controls rather than a `FormArray`: they are three
 * fixed fields, and the template indexes them for its own numbering.
 */
const LINK_FIELDS = ['link0', 'link1', 'link2'] as const;

/**
 * The account's public face: its username, its picture, and what a visitor to
 * its profile reads — a bio, a website and up to three links.
 *
 * None of it is gated on the password: a username is not a credential and
 * changing it moves control of nothing, and neither does a sentence about
 * yourself. The picture is re-encoded server-side into the whole variant
 * matrix, so there is no crop here: the API squares and re-encodes whatever it
 * is given, and a crop UI would be a second, weaker definition of what the
 * stored image is.
 *
 * The link fields carry the contract's own `socialUrlSchema`, so what may be
 * typed here is what the API will store — including the normalization: a link
 * pasted with its tracking parameters comes back from the write without them,
 * and the field is redrawn from the answer rather than from what was typed.
 */
@Component({
  selector: 'web-account-profile-section',
  imports: [
    AccountSection,
    LgAvatar,
    LgButton,
    LgFormField,
    LgInputText,
    LgMarkdownField,
    LgMessage,
    LgTextarea,
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

  // One group for the whole section, so the `<form>` carries `[formGroup]` and
  // a single Save writes everything shown in it.
  protected readonly form = new FormGroup({
    username: new FormControl(this.session.user()?.username ?? '', {
      nonNullable: true,
      validators: [Validators.required, zodValidator(usernameSchema)]
    }),
    bio: new FormControl(this.session.user()?.bio ?? '', {
      nonNullable: true,
      validators: [zodValidator(bioSchema)]
    }),
    websiteUrl: new FormControl(this.session.user()?.websiteUrl ?? '', {
      nonNullable: true,
      validators: [zodValidator(socialUrlSchema)]
    }),
    link0: this.linkControl(0),
    link1: this.linkControl(1),
    link2: this.linkControl(2)
  });

  /**
   * The three slots in order, each with its own message. Built once rather than
   * called from the template, which would make a new signal per change
   * detection.
   */
  protected readonly linkFields = LINK_FIELDS.map((name) => ({
    name,
    error: fieldError(this.form.controls[name], 'url')
  }));

  /**
   * What the field's counter and preview read. A signal rather than
   * `controls.bio.value`, which is a plain getter nothing re-reads when a save
   * writes the trimmed bio back through `redraw`.
   */
  protected readonly bio = toSignal(this.form.controls.bio.valueChanges, {
    initialValue: this.session.user()?.bio ?? ''
  });

  protected readonly usernameError = fieldError(
    this.form.controls.username,
    'username'
  );

  protected readonly bioError = fieldError(this.form.controls.bio, 'bio');
  protected readonly websiteError = fieldError(
    this.form.controls.websiteUrl,
    'url'
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

  /** The stored links, which an account with none has an empty list of. */
  private storedLinks(): SocialLink[] {
    return this.session.user()?.socialLinks ?? [];
  }

  /** One link slot, seeded from what is stored in it. */
  private linkControl(index: number): FormControl<string> {
    return new FormControl(this.storedLinks()[index]?.url ?? '', {
      nonNullable: true,
      validators: [zodValidator(socialUrlSchema)]
    });
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    this.saved.set(false);

    // The body is the request schema's own output, so what is sent is what the
    // API accepts by definition — and the links leave here in the form the API
    // stores rather than the form they were typed in.
    const body = updateUserRequestSchema.safeParse({
      username: this.form.controls.username.value,
      bio: this.form.controls.bio.value,
      // An emptied field means "no website", which the column spells `null`.
      websiteUrl: this.form.controls.websiteUrl.value.trim() || null,
      // A blank slot is no slot rather than an empty one: the list is the
      // member's links, and the order of the ones they filled in is kept.
      socialLinks: LINK_FIELDS.map((name) =>
        this.form.controls[name].value.trim()
      ).filter((url) => url !== '')
    });
    if (!body.success || this.form.invalid) return;

    this.saving.set(true);
    try {
      const result = await firstValueFrom(this.userApi.update(body.data));
      this.session.updated(result.user);
      this.redraw(result.user);
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

  /**
   * Puts the stored values back into the fields, which is where a normalized
   * link becomes visible: one pasted with `?utm_source=…` on it comes back from
   * the write without it, and the field is redrawn from the answer rather than
   * from what was typed.
   */
  private redraw(user: UserResponse): void {
    this.form.setValue({
      username: user.username,
      bio: user.bio,
      websiteUrl: user.websiteUrl ?? '',
      link0: user.socialLinks[0]?.url ?? '',
      link1: user.socialLinks[1]?.url ?? '',
      link2: user.socialLinks[2]?.url ?? ''
    });
    this.form.markAsPristine();
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
