import { Component, input } from '@angular/core';

/**
 * One captioned group of controls inside {@link LgUserPanel} — a theme
 * switcher, a language list, a block of settings toggles.
 *
 * The caption text is the caller's; its treatment lives here, so the panel
 * keeps one rhythm wherever the sections themselves come from.
 */
@Component({
  selector: 'lg-user-panel-section',
  host: { class: 'flex flex-col gap-2' },
  template: `
    <span class="text-xs font-semibold tracking-wider text-muted uppercase">{{
      label()
    }}</span>
    <ng-content />
  `
})
export class LgUserPanelSection {
  readonly label = input.required<string>();
}
