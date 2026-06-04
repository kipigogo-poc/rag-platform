import { Module } from '@nestjs/common';
import { ContentSessionsService } from './content-sessions.service';
import { ContentSessionsController } from './content-sessions.controller';

@Module({
  controllers: [ContentSessionsController],
  providers: [ContentSessionsService],
  exports: [ContentSessionsService],
})
export class ContentSessionsModule {}
