import { Module } from '@nestjs/common';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

@Module({
  controllers: [MetaController],
  providers: [MetaService]
})
export class MetaModule {}
