import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  documentReportReasonSchema,
  emailSchema,
  type DocumentReportReason
} from '@logigator/contract';
import {
  LgButton,
  LgDialogContent,
  LgFormField,
  LgInputText,
  LgMessage,
  LgSelect,
  LgTextarea
} from '@logigator/ui';
import {
  CommunityApiService,
  type CommunityKind
} from '../../api/services/community-api.service';
import { genericFailureKey } from '../../forms/api-failure';
import { fieldError } from '../../forms/field-error';
import { zodValidator } from '../../forms/zod-validator';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationKey } from '../../translation/translation-key.model';
import { TranslationService } from '../../translation/translation.service';

export interface ReportDocumentData {
  kind: CommunityKind;
  link: string;
}

/** The longest explanation the API takes. */
const MAX_EXPLANATION_LENGTH = 2000;

/** A value of only whitespace is no explanation; the API trims it to nothing. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() === '' ? { required: true } : null;
}

/**
 * Reporting a document: a reason from the contract's closed list, what is
 * wrong, and an address for a reply if the reader wants one. Open to anybody
 * the page is open to, signed in or not. Once sent, the form gives way to a
 * plain confirmation; nothing about the report is shown back.
 */
@Component({
  selector: 'web-report-document-dialog',
  imports: [
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    LgSelect,
    LgTextarea,
    ReactiveFormsModule,
    TranslateDirective
  ],
  templateUrl: './report-document-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportDocumentDialog extends LgDialogContent<ReportDocumentData> {
  private readonly communityApi = inject(CommunityApiService);
  private readonly translation = inject(TranslationService);

  private readonly data = this.dialogData!;

  protected readonly MAX_EXPLANATION_LENGTH = MAX_EXPLANATION_LENGTH;

  protected readonly form = new FormGroup({
    reason: new FormControl<DocumentReportReason | null>(null, {
      validators: [Validators.required]
    }),
    explanation: new FormControl('', {
      nonNullable: true,
      validators: [notBlank]
    }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: [zodValidator(emailSchema, { optional: true })]
    })
  });

  /** In the contract's order, labelled in the page's language. */
  protected readonly reasons = computed(() => {
    this.translation.activeLang();
    return documentReportReasonSchema.options.map((value) => ({
      value,
      label: this.translation.translate(
        `pages.community.report.reasons.${value}`
      )
    }));
  });

  /**
   * Only `required` can fail on these two, so the kind, which picks the
   * message for a schema failure, is never read: the textarea's `maxlength`
   * holds the explanation's cap.
   */
  protected readonly reasonError = fieldError(
    this.form.controls.reason,
    'documentDescription'
  );
  protected readonly explanationError = fieldError(
    this.form.controls.explanation,
    'documentDescription'
  );
  protected readonly emailError = fieldError(
    this.form.controls.contactEmail,
    'email'
  );

  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    const { reason, explanation, contactEmail } = this.form.getRawValue();
    if (this.form.invalid || this.sending() || !reason) return;

    this.sending.set(true);
    try {
      await firstValueFrom(
        this.communityApi.report(this.data.kind, this.data.link, {
          reason,
          explanation: explanation.trim(),
          // Left out rather than sent empty: the API checks any address given.
          ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {})
        })
      );
      this.sent.set(true);
    } catch (error) {
      this.formError.set(genericFailureKey(error));
    } finally {
      this.sending.set(false);
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
