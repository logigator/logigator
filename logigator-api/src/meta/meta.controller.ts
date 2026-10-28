import { Controller, Get } from '@nestjs/common';
import type { MetaResponse } from '@logigator/contract';
import { MetaService } from './meta.service';

@Controller('meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  /**
   * Also serves as the liveness probe: it answers without touching anything
   * external.
   */
  @Get()
  getMeta(): MetaResponse {
    return this.meta.getMeta();
  }
}
