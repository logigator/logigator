import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TranslocoDirective } from '@jsverse/transloco';
import { ProjectService } from '../../project/project.service';

/** Compact +/- zoom pill — the discoverable touch fallback to pinch-zoom. */
@Component({
  selector: 'app-zoom-fab',
  imports: [ButtonModule, TranslocoDirective],
  template: `
    <div
      *transloco="let t"
      class="flex flex-col gap-1 rounded-full bg-content/90 p-1 shadow-lg backdrop-blur"
    >
      <p-button
        icon="ph ph-plus"
        severity="secondary"
        rounded
        [ariaLabel]="t('toolBar.zoomIn')"
        (onClick)="zoomIn()"
      ></p-button>
      <p-button
        icon="ph ph-minus"
        severity="secondary"
        rounded
        [ariaLabel]="t('toolBar.zoomOut')"
        (onClick)="zoomOut()"
      ></p-button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ZoomFabComponent {
  private readonly projectService = inject(ProjectService);

  protected zoomIn(): void {
    this.projectService.activeProject()?.zoomIn();
  }

  protected zoomOut(): void {
    this.projectService.activeProject()?.zoomOut();
  }
}
