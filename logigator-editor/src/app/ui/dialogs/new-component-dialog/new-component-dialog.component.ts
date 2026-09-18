import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DialogRef,
  LgButton,
  LgInputText,
  LgMessage,
  LgSelectButton,
  LgToggleSwitch,
  LgTooltip
} from '@logigator/ui';
import { TranslationService } from '../../../translation/translation.service';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { UserService } from '../../../user/user.service';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * Collects the metadata for a new custom component and hands it to
 * {@link CustomComponentService.createComponent}, which opens an empty editor
 * tab. The length limits mirror the contract's schemas.
 */
@Component({
  selector: 'app-new-component-dialog',
  imports: [
    FormsModule,
    LgInputText,
    LgToggleSwitch,
    LgSelectButton,
    LgTooltip,
    LgButton,
    TranslateDirective,
    LgMessage
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
  protected readonly isPublic = signal(true);
  /** Cloud when signed in; local is the only creatable option otherwise. */
  protected readonly source = signal<'server' | 'browser'>(
    this.userService.user() ? 'server' : 'browser'
  );

  protected get canCreate(): boolean {
    if (this.name().trim().length === 0 || this.symbol().trim().length === 0)
      return false;
    if (this.source() === 'server' && !this.userService.user()) return false;
    return true;
  }

  protected create(): void {
    if (!this.canCreate) return;
    // Fire-and-forget: the dialog closes optimistically and a failed create
    // surfaces through the service's toast.
    void this.customComponentService
      .createComponent({
        name: this.name().trim(),
        symbol: this.symbol().trim(),
        description: this.description().trim(),
        isPublic: this.isPublic(),
        source: this.source()
      })
      .catch(() => undefined);
    this.ref.close();
  }
}
