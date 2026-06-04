import { IsString, IsUUID, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SaveContentSessionDto {
  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsUUID()
  subjectId: string;

  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsObject()
  notes: Record<string, unknown>;

  @ApiProperty()
  @IsArray()
  quiz: Record<string, unknown>[];
}
