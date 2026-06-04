import { Controller, Post, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { TelegramService } from './telegram.service';

@ApiTags('telegram')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('link-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a one-time token to link a Telegram account' })
  @ApiResponse({
    status: 200,
    schema: { example: { token: 'abc123...', expiresInSeconds: 900 } },
  })
  async getLinkToken(
    @CurrentUser() user: AuthUser,
  ): Promise<{ token: string; expiresInSeconds: number }> {
    const token = await this.telegramService.createLinkToken(user.id);
    return { token, expiresInSeconds: 900 };
  }
}
