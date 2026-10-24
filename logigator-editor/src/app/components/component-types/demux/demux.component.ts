import { Component } from '../../component';
import { demuxMeta } from '@logigator/core';
import { demuxComponentConfig, DemuxOptions } from './demux.config';

export class DemuxComponent extends Component<DemuxOptions> {
  public readonly config = demuxComponentConfig;

  constructor(options: DemuxOptions) {
    super(demuxMeta, options);
  }

  protected override get symbol(): string {
    // Module-level config: evaluated before the `config` field is assigned.
    return demuxComponentConfig.symbol;
  }

  protected draw(): void {
    this.addBody(this.bodyGridWidth, this.bodyGridHeight);
  }
}
