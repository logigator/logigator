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
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { UserService } from '../../../user/user.service';

/**
 * Collects the metadata for a new custom component (name, symbol, description,
 * visibility) and hands it to {@link CustomComponentService.createComponent},
 * which opens an empty editor tab. Limits mirror the backend's columns
 * (name ≤ 20, symbol ≤ 5).
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
    TranslocoDirective,
    LgMessage
  ],
  templateUrl: './new-component-dialog.component.html'
})
export class NewComponentDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly transloco = inject(TranslocoService);
  protected readonly userService = inject(UserService);

  protected readonly sourceOptions = [
    {
      label: this.transloco.translate('newComponentDialog.storeCloud'),
      value: 'server' as const
    },
    {
      label: this.transloco.translate('newComponentDialog.storeLocal'),
      value: 'browser' as const
    }
  ];

  protected readonly name = signal('');
  protected readonly symbol = signal('');
  protected readonly description = signal('');
  protected readonly isPublic = signal(true);
  protected readonly source = signal<'server' | 'browser'>('server');

  protected get canCreate(): boolean {
    if (this.name().trim().length === 0 || this.symbol().trim().length === 0)
      return false;
    if (this.source() === 'server' && !this.userService.user()) return false;
    return true;
  }

  protected create(): void {
    if (!this.canCreate) return;
    // Fire-and-forget: a server create is async (POST) but the dialog closes
    // optimistically; failures surface via a toast from the service.
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
