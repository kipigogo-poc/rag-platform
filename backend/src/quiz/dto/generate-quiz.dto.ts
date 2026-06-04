import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateQuizDto {
  @ApiPropertyOptional({
    description: 'Session ID for a single document. Omit to consolidate all documents in the subject.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({
    description: 'The subject ID (used for vector store filtering)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiPropertyOptional({
    description: 'Narrow the quiz to a specific topic within the document(s)',
    example: 'photosynthesis',
  })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiPropertyOptional({
    description: 'Number of questions to generate (1–20)',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  questionCount?: number = 5;
}
