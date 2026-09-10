import { Component } from '../../component';
import { decoderMeta } from '@logigator/core';
import { decoderComponentConfig, DecoderOptions } from './decoder.config';

export class DecoderComponent extends Component<DecoderOptions> {
  public readonly config = decoderComponentConfig;

  constructor(options: DecoderOptions) {
    super(decoderMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return decoderComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
