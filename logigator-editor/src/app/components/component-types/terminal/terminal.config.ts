import { terminalMeta, TerminalTextSize } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { SelectButtonComponentOption } from '../../component-options/select-button/select-button.component-option';
import { TerminalComponent } from './terminal.component';
import { TerminalInspection } from './terminal-inspection';

export interface TerminalOptions {
  [key: string]: ComponentOption;
  columns: NumberComponentOption;
  rows: NumberComponentOption;
  textSize: SelectButtonComponentOption<TerminalTextSize>;
}

export const terminalComponentConfig: ComponentConfig<TerminalOptions> =
  configFromMeta(terminalMeta, {
    // A screen with a prompt and the cursor block after it.
    symbolShape: {
      stroke: 'M1 2.5h16v13H1z M4 6.5l2.5 2.5L4 11.5',
      fill: 'M8 10.5h3v1.5h-3z'
    },
    inspection: (component) =>
      new TerminalInspection(component as TerminalComponent),
    create: (options) => new TerminalComponent(options)
  });
