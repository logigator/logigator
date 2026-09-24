import { Component } from '../../component';
import { xorMeta } from '@logigator/core';
import { xorComponentConfig, XorOptions } from './xor.config';

export class XorComponent extends Component<XorOptions> {
  public readonly config = xorComponentConfig;

  constructor(options: XorOptions) {
    super(xorMeta, options);
  }

  protected override get symbol(): string {
    return xorComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(2, Math.max(this.numInputs, this.numOutputs));
  }
}
