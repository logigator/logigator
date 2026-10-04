import { Component, computed, inject } from '@angular/core';
import { LgPanelMenu } from '@logigator/ui';
import { EditorMenuService } from '../editor-menu.service';
import { MobileUiService } from '../../layout/mobile-ui.service';
import { withSheetClose } from './with-sheet-close';

/**
 * Content of the compact editor sheet: the flat list of editor actions. Every
 * action also dismisses the sheet, so a dialog it opens lands on an uncovered
 * board.
 */
@Component({
  selector: 'app-mobile-project-menu',
  imports: [LgPanelMenu],
  template: `<lg-panel-menu [model]="items()"></lg-panel-menu>`
})
export class MobileProjectMenuComponent {
  private readonly mobileUi = inject(MobileUiService);
  private readonly editorMenu = inject(EditorMenuService);

  protected readonly items = computed(() =>
    withSheetClose(this.editorMenu.compactItems(), () => this.mobileUi.close())
  );
}
