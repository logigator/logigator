import { Component, inject } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { ProjectService } from '../../project/project.service';
import { TranslateDirective } from '../../translation/translate.directive';

/** Compact +/- zoom pill — the discoverable touch fallback to pinch-zoom. */
@Component({
  selector: 'app-zoom-fab',
  imports: [LgButton, TranslateDirective],
  template: `
    <div
      *appTranslate="let t"
      class="flex flex-col gap-2 rounded-full bg-content p-1.5 shadow-lg"
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
  `
})
export class ZoomFabComponent {
  private readonly projectService = inject(ProjectService);

  protected zoomIn(): void {
    this.projectService.activeProject()?.viewport.zoomIn();
  }

  protected zoomOut(): void {
    this.projectService.activeProject()?.viewport.zoomOut();
  }
}
