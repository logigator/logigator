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
import { FileUploadModule, type FileSelectEvent } from 'primeng/fileupload';
import { TranslocoDirective } from '@jsverse/transloco';
import { PersistenceService } from '../../persistence/persistence.service';
import { LoggingService } from '../../logging/logging.service';
import type { BrowserProjectSummary } from '../../persistence/browser/browser-project.types';

@Component({
	selector: 'app-open-project-dialog',
	imports: [TabsModule, FileUploadModule, TranslocoDirective, DatePipe],
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
	protected readonly importError = signal<string | null>(null);

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

	protected onFileSelect(event: FileSelectEvent): void {
		const file = event.files[0];
		if (!file) return;

		this.importError.set(null);

		const reader = new FileReader();
		reader.onload = () => {
			const content = reader.result as string;
			this.persistenceService
				.importProjectFromJson(content)
				.then(() => this.ref.close())
				.catch((err: unknown) => {
					const message =
						err instanceof Error ? err.message : String(err);
					this.loggingService.error(
						`Failed to import file: ${message}`,
						'OpenProjectDialogComponent'
					);
					this.importError.set(message);
				});
		};
		reader.onerror = () => {
			this.importError.set('Failed to read file');
		};
		reader.readAsText(file);
	}
}
