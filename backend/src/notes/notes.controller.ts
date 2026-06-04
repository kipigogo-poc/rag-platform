import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { NotesService } from './notes.service';
import { GenerateNotesDto } from './dto/generate-notes.dto';
import { Notes } from './interfaces/notes.interface';

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate structured study notes from an ingested document' })
  @ApiResponse({
    status: 200,
    description: 'Structured Notes object',
    schema: {
      example: {
        title: 'Introduction to Photosynthesis',
        summary: 'Photosynthesis is the process by which plants convert sunlight into energy...',
        keyPoints: ['Chlorophyll absorbs blue and red light', 'Produces glucose and oxygen'],
        sections: [
          { heading: 'Light Reactions', content: 'The light-dependent reactions occur in...' },
        ],
      },
    },
  })
  async generate(@Body() dto: GenerateNotesDto, @CurrentUser() user: AuthUser): Promise<Notes> {
    return this.notesService.generateNotes(dto, user.id);
  }
}
