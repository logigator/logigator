import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  documentDescriptionSchema,
  documentNameSchema
} from '@logigator/contract';
import {
  LgButton,
  LgDialogContent,
  LgFormField,
  LgInputText,
  LgMessage,
  LgTextarea
} from '@logigator/ui';
import { DocumentsApiService } from '../../../api/services/documents-api.service';
import type { CommunityKind } from '../../../api/services/community-api.service';
import { genericFailureKey } from '../../../forms/api-failure';
import { fieldError } from '../../../forms/field-error';
import { zodValidator } from '../../../forms/zod-validator';
import { TranslateDirective } from '../../../translation/translate.directive';
import { TranslationKey } from '../../../translation/translation-key.model';
import { MyDocumentsService } from '../my-documents.service';

/** The row being edited, as the shelf already holds it — so the dialog opens
 * filled in rather than fetching what the grid is drawing. */
export interface EditDocumentData {
  kind: CommunityKind;
  id: string;
  name: string;
  description: string;
}

/**
 * A document's name and description. Both travel inside every placed snapshot
 * of a component, so the API bumps its version and offers instances an update;
 * the shelf only has to say what it wrote.
 *
 * The write-back goes straight into {@link MyDocumentsService} rather than out
 * through the dialog's result: the change is already on the server by the time
 * the dialog closes, and a reader dismissing it with the corner control must
 * not undo the grid's agreement with what they just saved.
 */
@Component({
  selector: 'web-edit-document-dialog',
  imports: [
    LgButton,
    LgFormField,
    LgInputText,
    LgMessage,
    LgTextarea,
    ReactiveFormsModule,
    TranslateDirective
  ],
  templateUrl: './edit-document-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditDocumentDialog extends LgDialogContent<EditDocumentData> {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly documents = inject(MyDocumentsService);

  private readonly data = this.dialogData!;

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.name, {
      nonNullable: true,
      validators: [zodValidator(documentNameSchema)]
    }),
    description: new FormControl(this.data.description, {
      nonNullable: true,
      validators: [zodValidator(documentDescriptionSchema)]
    })
  });

  protected readonly nameError = fieldError(
    this.form.controls.name,
    'documentName'
  );
  protected readonly descriptionError = fieldError(
    this.form.controls.description,
    'documentDescription'
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

    // Only what actually differs — compared against the values the dialog
    // opened on, not `dirty`, which is true of a field typed into and put back.
    // Both travel inside every placed snapshot of a component, and the API acts
    // on a field being *present*, so sending an unchanged one bumps the version
    // and offers every instance an update for nothing.
    const body = {
      ...(name.data === this.data.name ? {} : { name: name.data }),
      ...(description.data === this.data.description
        ? {}
        : { description: description.data })
    };
    if (Object.keys(body).length === 0) {
      this.dialogRef.close();
      return;
    }

    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.data.kind === 'projects'
          ? this.documentsApi.updateProject(this.data.id, body)
          : this.documentsApi.updateComponent(this.data.id, body)
      );
      this.documents.applyPatch(this.data.id, {
        name: updated.name,
        description: updated.description
      });
      this.dialogRef.close();
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
