import { terminalMeta } from '@logigator/core';
import { Component } from '../app/components/component';
import { ComponentConfig } from '../app/components/component-config.model';
import { ComponentOption } from '../app/components/component-option';
import { configFromMeta } from '../app/components/config-from-meta';

type FakeTerminalOptions = Record<string, ComponentOption>;

/**
 * A terminal as the compiler sees it — the built-in's type, options and
 * ports, `D0`…`D7` then `CLK` — drawing nothing beyond the standard frame.
 */
export class FakeTerminal extends Component<FakeTerminalOptions> {
  public readonly config = fakeTerminalConfig;

  constructor(options: FakeTerminalOptions) {
    super(terminalMeta, options);
  }

  protected draw(): void {
    // Nothing of its own: only the ports matter.
  }
}

/** The terminal's config over {@link FakeTerminal}, for the provider. */
export const fakeTerminalConfig: ComponentConfig<FakeTerminalOptions> =
  configFromMeta(terminalMeta, {
    create: (options) => new FakeTerminal(options)
  });
