import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { Button } from 'primeng/button';

export interface SaveProjectDialogResult {
  name: string;
  destination: 'server' | 'local';
  isPublic: boolean;
}

/**
 * Prompts for the name + destination of a never-saved project draft on its
 * first save. Collects input only — it closes the dialog with a
 * {@link SaveProjectDialogResult} (or `undefined` when cancelled) and leaves the
 * actual persistence to `SaveCoordinatorService`.
 */
@Component({
  selector: 'app-save-project-dialog',
  imports: [FormsModule, InputTextModule, CheckboxModule, Button],
  templateUrl: './save-project-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SaveProjectDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);

  protected readonly name = signal<string>(this.config.data?.name ?? '');
  protected readonly destination = signal<'server' | 'local'>('local');
  protected readonly isPublic = signal(false);

  protected get canSave(): boolean {
    return this.name().trim().length > 0;
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
