import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { PersistenceService } from '../../persistence/persistence.service';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';

@Component({
  selector: 'app-new-project-dialog',
  imports: [FormsModule, InputTextModule, CheckboxModule, Button],
  templateUrl: './new-project-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewProjectDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly persistenceService = inject(PersistenceService);
  private readonly toastService = inject(ToastService);
  private readonly logging = inject(LoggingService);

  protected readonly name = signal('');
  protected readonly destination = signal<'server' | 'local'>('server');
  protected readonly isPublic = signal(false);

  protected get canCreate(): boolean {
    return this.name().trim().length > 0;
  }

  protected create(): void {
    if (!this.canCreate) return;
    const name = this.name().trim();
    if (this.destination() === 'server') {
      void this.persistenceService
        .createProject(name, undefined, this.isPublic())
        .catch(() => {
          this.logging.error(
            'Failed to create project',
            'NewProjectDialogComponent'
          );
          this.toastService.error('Failed to create project');
        });
    } else {
      this.persistenceService.createLocalProject(name);
    }
    this.ref.close();
  }
}
