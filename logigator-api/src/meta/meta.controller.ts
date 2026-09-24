import { Controller, Get } from '@nestjs/common';
import type { MetaResponse } from '@logigator/contract';
import { MetaService } from './meta.service';

@Controller('meta')
export class MetaController {
  constructor(private readonly meta: MetaService) {}

  /**
   * Also serves as the liveness probe: it answers without touching anything
   * external. A readiness endpoint that checks the database and Redis arrives
   * with them.
   */
  @Get()
  getMeta(): MetaResponse {
    return this.meta.getMeta();
  }
}
