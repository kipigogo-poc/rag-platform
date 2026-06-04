import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramSessionsService } from './telegram-sessions.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramSessionsService],
})
export class TelegramModule {}
