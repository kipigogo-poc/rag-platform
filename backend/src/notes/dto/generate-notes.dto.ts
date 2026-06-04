import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateNotesDto {
  @ApiPropertyOptional({
    description: 'Session ID for a single document. Omit to consolidate all documents in the subject.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiPropertyOptional({ example: 'photosynthesis', description: 'Focus topic for the notes' })
  @IsString()
  @IsOptional()
  topic?: string;
}
