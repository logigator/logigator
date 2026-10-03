import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DialogRef,
  LgButton,
  LgInputText,
  LgMarkdownField,
  LgMessage,
  LgSelectButton,
  LgTextarea,
  type LgDocumentVisibility
} from '@logigator/ui';
import { TranslationService } from '../../../translation/translation.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { UserService } from '../../../user/user.service';
import { TranslateDirective } from '../../../translation/translate.directive';
import { VisibilityPickerComponent } from '../../visibility-picker/visibility-picker.component';
import { normalizeAuthoredText } from '@logigator/core';

/**
 * Collects the metadata for a new custom component and hands it to
 * {@link CustomComponentService.createComponent}, which opens an empty editor
 * tab. The length limits mirror the contract's schemas.
 */
/** Mirrors the contract's `documentDescriptionSchema` limit. */
const DESCRIPTION_MAX_LENGTH = 2048;

@Component({
  selector: 'app-new-component-dialog',
  imports: [
    FormsModule,
    LgInputText,
    LgSelectButton,
    LgButton,
    TranslateDirective,
    LgMessage,
    VisibilityPickerComponent,
    LgMarkdownField,
    LgTextarea
  ],
  templateUrl: './new-component-dialog.component.html'
})
export class NewComponentDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly translation = inject(TranslationService);
  protected readonly userService = inject(UserService);

  protected readonly sourceOptions = [
    {
      label: this.translation.translate('newComponentDialog.storeLocal'),
      value: 'browser' as const
    },
    {
      label: this.translation.translate('newComponentDialog.storeCloud'),
      value: 'server' as const
    }
  ];

  protected readonly name = signal('');
  protected readonly symbol = signal('');
  protected readonly description = signal('');
  /** Creating keeps publishing, which is what this dialog is for. */
  protected readonly visibility = signal<LgDocumentVisibility>('public');
  /** Cloud when signed in; local is the only creatable option otherwise. */
  protected readonly source = signal<'server' | 'browser'>(
    this.userService.user() ? 'server' : 'browser'
  );

  protected get canCreate(): boolean {
    if (this.name().trim().length === 0 || this.symbol().trim().length === 0)
      return false;
    // The description is capped too. The class comment above has claimed the
    // limits mirror the contract's schemas since this dialog was written, and
    // for the description alone it was not true: a component saved to the
    // browser never meets the contract, so nothing else would refuse it.
    if (this.description().length > DESCRIPTION_MAX_LENGTH) return false;
    if (this.source() === 'server' && !this.userService.user()) return false;
    return true;
  }

  protected readonly descriptionMaxLength = DESCRIPTION_MAX_LENGTH;

  protected create(): void {
    if (!this.canCreate) return;
    // Fire-and-forget: the dialog closes optimistically and a failed create
    // surfaces through the service's toast.
    void this.customComponentService
      .createComponent({
        name: this.name().trim(),
        symbol: this.symbol().trim(),
        // Normalized here rather than only in the contract: a browser-stored
        // component is written straight to IndexedDB, so this is the only
        // place that sees it.
        description: normalizeAuthoredText(this.description()),
        visibility: this.visibility(),
        source: this.source()
      })
      .catch(() => undefined);
    this.ref.close();
  }
}
