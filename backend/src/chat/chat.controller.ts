import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the RAG chatbot' })
  @ApiResponse({
    status: 200,
    schema: { example: { reply: 'Photosynthesis is the process by which...' } },
  })
  async message(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ reply: string }> {
    const reply = await this.chatService.ask(
      dto.message,
      user.id,
      dto.subjectId,
      dto.sessionId,
      dto.history ?? [],
    );
    return { reply };
  }
}
