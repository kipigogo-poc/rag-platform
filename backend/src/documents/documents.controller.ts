import {
  Controller,
  Post,
  Get,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a PDF or TXT document for RAG ingestion' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'subjectId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        subjectId: { type: 'string', format: 'uuid', description: 'Subject to associate this document with' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Document ingested successfully',
    schema: {
      example: {
        sessionId: 'uuid-v4',
        fileName: 'lecture-notes.pdf',
        chunks: 42,
        message: 'Document ingested and vectorized successfully.',
      },
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send a PDF or TXT as multipart/form-data with field name "file".',
      );
    }
    if (!subjectId) {
      throw new BadRequestException('Query parameter "subjectId" is required.');
    }
    return this.documentsService.ingestDocument(file, user.id, subjectId);
  }

  @Get()
  @ApiOperation({ summary: 'List ingested document sessions for a subject' })
  @ApiQuery({ name: 'subjectId', required: true, description: 'Filter sessions by subject' })
  @ApiResponse({ status: 200, description: 'Array of session metadata' })
  async listSessions(
    @Query('subjectId') subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documentsService.listSessions(user.id, subjectId);
  }
}
