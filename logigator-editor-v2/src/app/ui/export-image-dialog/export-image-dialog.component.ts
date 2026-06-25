import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SliderModule } from 'primeng/slider';
import { Button } from 'primeng/button';
import { TranslocoDirective } from '@jsverse/transloco';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import {
  ImageExportService,
  ImageFormat
} from '../../rendering/image-export.service';
import { Project } from '../../project/project';

/** Slider default; converted to a 0–1 quality on export. */
const DEFAULT_QUALITY_PERCENT = 92;

/**
 * Collects image-export settings (project, format, resolution, background,
 * JPEG/WebP quality) and delegates the work to {@link ImageExportService}. The
 * dialog closes once the export resolves; success/failure surfaces as a toast.
 */
@Component({
  selector: 'app-export-image-dialog',
  imports: [
    FormsModule,
    SelectButtonModule,
    SelectModule,
    ToggleSwitchModule,
    SliderModule,
    Button,
    TranslocoDirective
  ],
  templateUrl: './export-image-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExportImageDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly imageExport = inject(ImageExportService);

  protected readonly formatOptions = [
    { label: 'PNG', value: 'png' as const },
    { label: 'JPEG', value: 'jpeg' as const },
    { label: 'WebP', value: 'webp' as const }
  ];
  protected readonly resolutionOptions = [
    { label: '1×', value: 1 },
    { label: '2×', value: 2 },
    { label: '4×', value: 4 }
  ];

  /** Main project plus any open component editors, labelled by their name. */
  protected readonly projectOptions = computed(() => {
    const main = this.projectService.mainProject();
    const projects = [
      ...(main ? [main] : []),
      ...this.projectService.openComponents()
    ];
    return projects.map((project) => ({
      label: this._projectName(project),
      value: project
    }));
  });

  protected readonly project = signal<Project | null>(
    this.projectService.activeProject() ?? this.projectService.mainProject()
  );
  protected readonly format = signal<ImageFormat>('png');
  protected readonly multiplier = signal(2);
  protected readonly background = signal(true);
  protected readonly quality = signal(DEFAULT_QUALITY_PERCENT);
  protected readonly exporting = signal(false);

  /** PNG is lossless, so the quality control only applies to JPEG/WebP. */
  protected readonly showQuality = computed(() => this.format() !== 'png');

  protected readonly dimensions = computed(() => {
    const project = this.project();
    return project ? this.imageExport.previewSize(project, this.multiplier()) : null;
  });

  protected get canExport(): boolean {
    return !!this.project() && !this.exporting();
  }

  protected async export(): Promise<void> {
    const project = this.project();
    if (!project || this.exporting()) return;
    this.exporting.set(true);
    try {
      await this.imageExport.exportImage({
        project,
        format: this.format(),
        multiplier: this.multiplier(),
        background: this.background(),
        quality: this.quality() / 100
      });
    } finally {
      this.exporting.set(false);
      this.ref.close();
    }
  }

  protected cancel(): void {
    this.ref.close();
  }

  private _projectName(project: Project): string {
    return this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
  }
}
