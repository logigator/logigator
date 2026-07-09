import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DialogConfig,
  DialogRef,
  LgButton,
  LgInputText,
  LgMessage,
  LgSelectButton,
  LgToggleSwitch,
  LgTooltip
} from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { UserService } from '../../user/user.service';

export interface SaveProjectDialogResult {
  name: string;
  destination: 'server' | 'local';
  isPublic: boolean;
}

/** Mirrors the backend `UpdateProject`/`CreateProject` `name` `@MaxLength(20)`. */
const NAME_MAX_LENGTH = 20;

/**
 * Prompts for the name + destination of a never-saved project draft on its
 * first save. Collects input only — it closes the dialog with a
 * {@link SaveProjectDialogResult} (or `undefined` when cancelled) and leaves the
 * actual persistence to `SaveCoordinatorService`.
 */
@Component({
  selector: 'app-save-project-dialog',
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
  templateUrl: './save-project-dialog.component.html'
})
export class SaveProjectDialogComponent {
  private readonly ref = inject(DialogRef);
  private readonly config = inject(DialogConfig);
  private readonly transloco = inject(TranslocoService);
  protected readonly userService = inject(UserService);

  protected readonly destinationOptions = [
    {
      label: this.transloco.translate('saveProjectDialog.destinationCloud'),
      value: 'server' as const
    },
    {
      label: this.transloco.translate('saveProjectDialog.destinationLocal'),
      value: 'local' as const
    }
  ];

  protected readonly name = signal<string>(
    (this.config.data as { name?: string } | undefined)?.name ?? ''
  );
  protected readonly destination = signal<'server' | 'local'>('server');
  protected readonly isPublic = signal(true);
  protected readonly nameMaxLength = NAME_MAX_LENGTH;

  protected get canSave(): boolean {
    if (this.name().trim().length === 0) return false;
    if (this.destination() === 'server' && !this.userService.user())
      return false;
    return true;
  }

  protected save(): void {
    if (!this.canSave) return;
    this.ref.close({
      name: this.name().trim(),
      destination: this.destination(),
      isPublic: this.isPublic()
    } satisfies SaveProjectDialogResult);
  }
}
