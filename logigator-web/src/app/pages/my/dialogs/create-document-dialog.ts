import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  componentSymbolSchema,
  documentDescriptionSchema,
  documentNameSchema
} from '@logigator/contract';
import {
  LG_DOCUMENT_VISIBILITIES,
  LgButton,
  LgDialogContent,
  LgFormField,
  LgInputText,
  LgMarkdownField,
  LgMessage,
  LgSelectButton,
  LgTextarea,
  type LgDocumentVisibility
} from '@logigator/ui';
import type { CommunityKind } from '../../../api/services/community-api.service';
import { DocumentsApiService } from '../../../api/services/documents-api.service';
import {
  VISIBILITY_HINTS,
  VISIBILITY_LABELS
} from '../../../documents/visibility-tag';
import { genericFailureKey } from '../../../forms/api-failure';
import { fieldError } from '../../../forms/field-error';
import { zodValidator } from '../../../forms/zod-validator';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { TranslationService } from '../../../translation/translation.service';
import {
  MyDocumentsService,
  type MyDocumentRow
} from '../my-documents.service';

/** Which shelf the document is created on. */
export interface CreateDocumentData {
  kind: CommunityKind;
}

/**
 * A new, empty project or component: the row is created with no document, so
 * the board is blank and a component has no ports until a plug is placed in it.
 * What the API cannot supply is asked for here — a name for either, and the
 * symbol a component draws on its body.
 *
 * The state starts at `public`, as the editor's create dialogs do: making a
 * document is what somebody who wants it seen does first.
 *
 * The row goes straight into {@link MyDocumentsService}, for the reason the
 * edit dialog's write-back does: once the API has answered, the document
 * exists, and a reader dismissing the dialog while the request was in flight
 * must still find it on the shelf. The dialog also closes with it, so the page
 * can take a filtered or later view back to where a new row is drawn.
 */
@Component({
  selector: 'web-create-document-dialog',
  imports: [
    FormsModule,
    LgButton,
    LgFormField,
    LgInputText,
    LgMarkdownField,
    LgMessage,
    LgSelectButton,
    LgTextarea,
    ReactiveFormsModule,
    TranslateDirective
  ],
  templateUrl: './create-document-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateDocumentDialog extends LgDialogContent<
  CreateDocumentData,
  MyDocumentRow
> {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly documents = inject(MyDocumentsService);
  private readonly translation = inject(TranslationService);

  protected readonly isComponent = this.dialogData!.kind === 'components';

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, zodValidator(documentNameSchema)]
    }),
    // Carried by a project's form too, but never validated there: a control
    // that is not drawn must not be what keeps the form invalid.
    symbol: new FormControl('', {
      nonNullable: true,
      validators: this.isComponent
        ? [Validators.required, zodValidator(componentSymbolSchema)]
        : []
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [zodValidator(documentDescriptionSchema)]
    })
  });

  /** See the edit dialog: `controls.description.value` is not reactive. */
  protected readonly description = toSignal(
    this.form.controls.description.valueChanges,
    { initialValue: '' }
  );

  protected readonly nameError = fieldError(
    this.form.controls.name,
    'documentName'
  );
  protected readonly symbolError = fieldError(
    this.form.controls.symbol,
    'componentSymbol'
  );
  protected readonly descriptionError = fieldError(
    this.form.controls.description,
    'documentDescription'
  );

  protected readonly visibility = signal<LgDocumentVisibility>('public');

  /** A `computed` so the labels follow a language switch; see the share dialog. */
  protected readonly states = computed(() =>
    LG_DOCUMENT_VISIBILITIES.map((visibility) => ({
      value: visibility,
      label: this.translation.translate(VISIBILITY_LABELS[visibility])
    }))
  );

  protected readonly stateHint = computed(() =>
    this.translation.translate(VISIBILITY_HINTS[this.visibility()])
  );

  protected readonly saving = signal(false);
  protected readonly formError = signal<TranslationKey | null>(null);

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    if (this.form.invalid || this.saving()) return;

    // Through the schemas the API enforces, so the trim it applies is the one
    // the shelf then shows.
    const name = documentNameSchema.safeParse(this.form.controls.name.value);
    const description = documentDescriptionSchema.safeParse(
      this.form.controls.description.value
    );
    if (!name.success || !description.success) return;

    const body = {
      name: name.data,
      visibility: this.visibility(),
      ...(description.data ? { description: description.data } : {})
    };

    let request;
    if (this.isComponent) {
      const symbol = componentSymbolSchema.safeParse(
        this.form.controls.symbol.value
      );
      if (!symbol.success) return;
      request = this.documentsApi.createComponent({
        ...body,
        symbol: symbol.data
      });
    } else {
      request = this.documentsApi.createProject(body);
    }

    this.saving.set(true);
    try {
      const created = await firstValueFrom(request);
      this.documents.addRow(created);
      this.dialogRef.close(created);
    } catch (error) {
      this.formError.set(genericFailureKey(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
