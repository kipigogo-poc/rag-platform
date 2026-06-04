import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ContentSessionsService } from './content-sessions.service';
import { SaveContentSessionDto } from './dto/save-content-session.dto';

@ApiTags('content-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('content-sessions')
export class ContentSessionsController {
  constructor(private readonly svc: ContentSessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Persist notes + quiz for a document session' })
  save(
    @Body() dto: SaveContentSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.save(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List saved sessions for a subject' })
  @ApiQuery({ name: 'subjectId', required: true })
  list(
    @Query('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.listBySubject(user.id, subjectId);
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a saved session' })
  remove(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.deleteBySession(user.id, sessionId);
  }
}
