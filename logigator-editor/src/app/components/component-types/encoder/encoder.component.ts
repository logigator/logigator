import { Component } from '../../component';
import { encoderMeta } from '@logigator/core';
import { encoderComponentConfig, EncoderOptions } from './encoder.config';

export class EncoderComponent extends Component<EncoderOptions> {
  public readonly config = encoderComponentConfig;

  constructor(options: EncoderOptions) {
    super(encoderMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return encoderComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
