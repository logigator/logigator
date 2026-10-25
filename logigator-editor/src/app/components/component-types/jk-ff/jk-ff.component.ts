import { Component } from '../../component';
import { jkFfMeta } from '@logigator/core';
import { jkFfComponentConfig, JkFfOptions } from './jk-ff.config';

export class JkFfComponent extends Component<JkFfOptions> {
  public readonly config = jkFfComponentConfig;

  constructor(options: JkFfOptions) {
    super(jkFfMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return jkFfComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
