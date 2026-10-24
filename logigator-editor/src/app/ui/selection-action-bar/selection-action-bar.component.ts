import { Component, inject } from '@angular/core';
import { LgButton } from '@logigator/ui';
import { SelectionInspectorService } from '../../project/selection-inspector.service';
import { ClipboardService } from '../../clipboard/clipboard.service';
import { ProjectService } from '../../project/project.service';
import { MobileUiService } from '../../layout/mobile-ui.service';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * Copy/cut/paste/delete for the current selection, above the tool HUD on
 * `isCompact`, through the same ClipboardService the desktop surfaces use.
 *
 * With nothing selected the bar stays up in a paste-only form while the
 * clipboard holds something: pasting does not depend on the selection, and
 * compact has no menu bar to reach it through. Clearing the clipboard dismisses
 * that form.
 */
@Component({
  selector: 'app-selection-action-bar',
  imports: [LgButton, TranslateDirective],
  template: `
    @if (inspector.hasSelection() || clipboard.hasClipboard()) {
      <div
        *appTranslate="let t"
        class="flex items-center gap-1 rounded-full bg-content/95 px-2 py-1 shadow-lg backdrop-blur"
      >
        @if (inspector.hasSelection()) {
          <span class="px-1 text-sm text-muted tabular-nums">{{
            inspector.selectionCount()
          }}</span>
          @if (inspector.selectedComponent()) {
            <button
              lgButton
              icon="ph ph-sliders-horizontal"
              severity="secondary"
              rounded
              text
              [ariaLabel]="t('mobile.settings')"
              (onClick)="mobileUi.toggle('settings')"
            ></button>
          }
          <button
            lgButton
            icon="ph ph-copy"
            severity="secondary"
            rounded
            text
            [ariaLabel]="t('toolBar.copy')"
            (onClick)="copy()"
          ></button>
          <button
            lgButton
            icon="ph ph-scissors"
            severity="secondary"
            rounded
            text
            [ariaLabel]="t('toolBar.cut')"
            (onClick)="cut()"
          ></button>
        }
        @if (clipboard.hasClipboard()) {
          <button
            lgButton
            icon="ph ph-clipboard"
            severity="secondary"
            rounded
            text
            [ariaLabel]="t('toolBar.paste')"
            (onClick)="paste()"
          ></button>
        }
        @if (inspector.hasSelection()) {
          <button
            lgButton
            icon="ph ph-trash"
            severity="secondary"
            rounded
            text
            [ariaLabel]="t('toolBar.delete')"
            (onClick)="delete()"
          ></button>
          <button
            lgButton
            icon="ph ph-arrow-clockwise"
            severity="secondary"
            rounded
            text
            [ariaLabel]="t('toolBar.rotateCw')"
            (onClick)="rotate(1)"
          ></button>
          <button
            lgButton
            icon="ph ph-arrow-counter-clockwise"
            severity="secondary"
            rounded
            text
            [ariaLabel]="t('toolBar.rotateCcw')"
            (onClick)="rotate(3)"
          ></button>
        } @else {
          <button
            lgButton
            icon="ph ph-x"
            severity="secondary"
            rounded
            text
            [ariaLabel]="t('clipboard.clear')"
            (onClick)="clearClipboard()"
          ></button>
        }
      </div>
    }
  `
})
export class SelectionActionBarComponent {
  protected readonly inspector = inject(SelectionInspectorService);
  protected readonly mobileUi = inject(MobileUiService);
  protected readonly clipboard = inject(ClipboardService);
  private readonly projectService = inject(ProjectService);

  protected copy(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboard.copy(project);
  }

  protected cut(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboard.cut(project);
  }

  protected paste(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboard.paste(project);
  }

  protected delete(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboard.delete(project);
  }

  protected clearClipboard(): void {
    this.clipboard.clear();
  }

  protected rotate(steps: number): void {
    this.projectService.activeProject()?.requestSelectionRotation(steps);
  }
}
