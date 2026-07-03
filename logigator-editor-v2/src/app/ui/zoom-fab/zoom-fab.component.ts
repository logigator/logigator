import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { ProjectService } from '../../project/project.service';

/** Compact +/- zoom pill — the discoverable touch fallback to pinch-zoom. */
@Component({
  selector: 'app-zoom-fab',
  imports: [LgButton, TranslocoDirective],
  template: `
    <div
      *transloco="let t"
      class="flex flex-col gap-2 rounded-full bg-content/90 p-1 shadow-lg backdrop-blur"
    >
      <lg-button
        icon="ph ph-plus"
        severity="secondary"
        rounded
        [ariaLabel]="t('toolBar.zoomIn')"
        (onClick)="zoomIn()"
      ></lg-button>
      <lg-button
        icon="ph ph-minus"
        severity="secondary"
        rounded
        [ariaLabel]="t('toolBar.zoomOut')"
        (onClick)="zoomOut()"
      ></lg-button>
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
