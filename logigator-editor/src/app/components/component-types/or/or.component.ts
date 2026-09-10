import { Component } from '../../component';
import { orMeta } from '@logigator/core';
import { orComponentConfig, OrOptions } from './or.config';

export class OrComponent extends Component<OrOptions> {
  public readonly config = orComponentConfig;

  constructor(options: OrOptions) {
    super(orMeta, options);
  }

  protected override get symbol(): string {
    return orComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(2, Math.max(this.numInputs, this.numOutputs));
  }
}
