import { Injectable } from '@nestjs/common';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import type { MetaResponse } from '@logigator/contract';

@Injectable()
export class MetaService {
  /**
   * What clients need to know before they upload anything. The format version
   * comes from the shared core, which is also what the write path normalizes
   * documents to — one constant, both sides of the wire.
   */
  getMeta(): MetaResponse {
    return { formatVersion: CURRENT_FILE_VERSION };
  }
}
