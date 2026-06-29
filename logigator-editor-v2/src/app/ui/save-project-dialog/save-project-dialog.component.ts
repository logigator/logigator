import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TooltipModule } from 'primeng/tooltip';
import { LgButton, LgInputText, LgSelectButton, LgToggleSwitch } from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { UserService } from '../../user/user.service';
import { MessageComponent } from '../message/message.component';

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
    TooltipModule,
    LgButton,
    TranslocoDirective,
    MessageComponent
  ],
  templateUrl: './save-project-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaveProjectDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);
  private readonly transloco = inject(TranslocoService);
  protected readonly userService = inject(UserService);

  protected readonly destinationOptions = [
    {
      label: this.transloco.translate('saveProjectDialog.destinationServer'),
      value: 'server' as const
    },
    {
      label: this.transloco.translate('saveProjectDialog.destinationBrowser'),
      value: 'local' as const
    }
  ];

  protected readonly name = signal<string>(this.config.data?.name ?? '');
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
