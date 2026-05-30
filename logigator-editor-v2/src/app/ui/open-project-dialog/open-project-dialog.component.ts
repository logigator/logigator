import {
	ChangeDetectionStrategy,
	Component,
	inject,
	OnInit,
	signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { TabsModule } from 'primeng/tabs';
import { TranslocoDirective } from '@jsverse/transloco';
import { PersistenceService } from '../../persistence/persistence.service';
import { LoggingService } from '../../logging/logging.service';
import type { BrowserProjectSummary } from '../../persistence/browser/browser-project.types';

@Component({
	selector: 'app-open-project-dialog',
	imports: [TabsModule, TranslocoDirective, DatePipe],
	templateUrl: './open-project-dialog.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpenProjectDialogComponent implements OnInit {
	private readonly ref = inject(DynamicDialogRef);
	private readonly persistenceService = inject(PersistenceService);
	private readonly loggingService = inject(LoggingService);

	protected readonly activeTab = signal<string>('local');
	protected readonly localProjects = signal<BrowserProjectSummary[]>([]);
	protected readonly loadingLocal = signal(false);

	ngOnInit(): void {
		this.loadLocalProjects();
	}

	private loadLocalProjects(): void {
		this.loadingLocal.set(true);
		this.persistenceService
			.listBrowserProjects()
			.then((projects) => {
				this.localProjects.set(projects);
				this.loadingLocal.set(false);
			})
			.catch(() => {
				this.loggingService.error(
					'Failed to list local projects',
					'OpenProjectDialogComponent'
				);
				this.loadingLocal.set(false);
			});
	}

	protected openLocalProject(id: string): void {
		this.persistenceService
			.loadLocalProjectAsMain(id)
			.catch(() =>
				this.loggingService.error(
					'Failed to open local project',
					'OpenProjectDialogComponent'
				)
			);
		this.ref.close();
	}
}
