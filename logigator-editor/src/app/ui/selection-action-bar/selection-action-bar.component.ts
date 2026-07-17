import { Component, inject } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { SelectionInspectorService } from '../../project/selection-inspector.service';
import { ClipboardService } from '../../clipboard/clipboard.service';
import { ProjectService } from '../../project/project.service';

/**
 * Copy/cut/paste/delete for the current selection, surfaced just above the tool
 * HUD on `isCompact`. Renders only while something is selected; the same
 * ClipboardService calls the desktop tool bar and Edit menu make.
 */
@Component({
  selector: 'app-selection-action-bar',
  imports: [LgButton, TranslocoDirective],
  template: `
    @if (inspector.hasSelection()) {
      <div
        *transloco="let t"
        class="flex items-center gap-1 rounded-full bg-content/95 px-2 py-1 shadow-lg backdrop-blur"
      >
        <span class="px-1 text-sm text-muted tabular-nums">{{
          inspector.selectionCount()
        }}</span>
        <lg-button
          icon="ph ph-copy"
          severity="secondary"
          rounded
          text
          [ariaLabel]="t('toolBar.copy')"
          (onClick)="copy()"
        ></lg-button>
        <lg-button
          icon="ph ph-scissors"
          severity="secondary"
          rounded
          text
          [ariaLabel]="t('toolBar.cut')"
          (onClick)="cut()"
        ></lg-button>
        <lg-button
          icon="ph ph-clipboard"
          severity="secondary"
          rounded
          text
          [ariaLabel]="t('toolBar.paste')"
          (onClick)="paste()"
        ></lg-button>
        <lg-button
          icon="ph ph-trash"
          severity="secondary"
          rounded
          text
          [ariaLabel]="t('toolBar.delete')"
          (onClick)="delete()"
        ></lg-button>
        <lg-button
          icon="ph ph-arrow-clockwise"
          severity="secondary"
          rounded
          text
          [ariaLabel]="t('toolBar.rotateCw')"
          (onClick)="rotate(1)"
        ></lg-button>
        <lg-button
          icon="ph ph-arrow-counter-clockwise"
          severity="secondary"
          rounded
          text
          [ariaLabel]="t('toolBar.rotateCcw')"
          (onClick)="rotate(3)"
        ></lg-button>
      </div>
    }
  `
})
export class SelectionActionBarComponent {
  protected readonly inspector = inject(SelectionInspectorService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly projectService = inject(ProjectService);

  protected copy(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.copy(project);
  }

  protected cut(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.cut(project);
  }

  protected paste(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.paste(project);
  }

  protected delete(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.delete(project);
  }

  protected rotate(steps: number): void {
    this.projectService.activeProject()?.requestSelectionRotation(steps);
  }
}
