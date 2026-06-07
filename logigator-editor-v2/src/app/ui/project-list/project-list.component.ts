import {
  ChangeDetectionStrategy,
  Component, computed,
  inject,
  input,
  output
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

export interface ProjectListItem {
  id: string;
  name: string;
  lastEdited: string | number;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-project-list',
  imports: [
    DatePipe,
    FormsModule,
    Button,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    Paginator,
    TranslocoDirective
  ],
  templateUrl: './project-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectListComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly translocoService = inject(TranslocoService);

  readonly items = input<ProjectListItem[]>([]);
  readonly loading = input(false);
  readonly page = input(1);
  readonly totalItems = input(0);

  readonly open = output<string>();
  readonly delete = output<ProjectListItem>();
  readonly pageChange = output<number>();
  readonly searchChange = output<string>();

  protected readonly pageSize = PAGE_SIZE;
  protected searchQuery = '';

  protected paginatorFirst = computed(() => (this.page() - 1) * PAGE_SIZE);

  protected onSearchSubmit(): void {
    this.searchChange.emit(this.searchQuery);
  }

  protected onDeleteClick(event: Event, item: ProjectListItem): void {
    event.stopPropagation();
    event.preventDefault();

    this.confirmationService.confirm({
      target: event.currentTarget as HTMLElement,
      message: this.translocoService.translate(
        'openProjectDialog.deleteConfirmMessage',
        { name: item.name }
      ),
      acceptButtonProps: { severity: 'danger' },
      acceptLabel: this.translocoService.translate(
        'openProjectDialog.deleteAccept'
      ),
      rejectButtonProps: { severity: 'secondary', outlined: true },
      rejectLabel: this.translocoService.translate(
        'openProjectDialog.deleteReject'
      ),
      accept: () => this.delete.emit(item)
    });
  }

  protected onPaginatorChange(state: PaginatorState): void {
    this.pageChange.emit((state.page ?? 0) + 1);
  }
}
